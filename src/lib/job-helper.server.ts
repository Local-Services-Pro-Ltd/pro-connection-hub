import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiApiKey, aiAuthHeaders, aiChatUrl, aiModel, aiProvider } from "@/lib/ai-provider";
import { AI_ATTEMPT_TIMEOUT_MS } from "@/lib/qa-ai.server";
import type { JobHelperTrade, JobSuggestion } from "@/lib/job-helper.types";

type ChatMessage = { role: "system" | "user"; content: string };

class JobHelperTimeoutError extends Error {
  override name = "TimeoutError";
}

export function buildJobHelperBody(messages: ChatMessage[]) {
  const gemini = aiProvider() === "gemini";
  return {
    model: gemini ? aiModel("google/gemini-2.5-flash") : "openai/gpt-5.6-sol",
    messages,
    response_format: { type: "json_object" },
    ...(gemini ? { reasoning_effort: "low" } : {}),
  };
}

function systemPrompt(trades: JobHelperTrade[]) {
  const tradeList = trades.map((trade) => `${trade.slug} (${trade.name})`).join(", ");
  return [
    "You help a UK homeowner turn their own description into a clear job listing.",
    "Use only the details the homeowner supplied. Never invent dimensions, locations, access, timing, damage, materials or other facts.",
    "Return strict JSON with exactly these fields: trade_slug, title, description, questions_to_add, safety_note.",
    `trade_slug must be one of: ${tradeList}. Use null if none fits.`,
    "title is a concise job title of at most 80 characters.",
    "description is 60-600 characters of plain UK English, written as the homeowner. Cover what needs doing, where in the property, how big it is, access and when, but only using facts the homeowner gave. Never invent details. Leave out anything they did not say rather than writing 'not sure' after it; the follow-up questions cover the gaps. Write in the first person, in natural sentences (e.g. 'Water drips through the kitchen ceiling when we use the upstairs shower.').",
    "questions_to_add contains at most 3 short questions the homeowner could answer to help firms quote.",
    "safety_note is null except for gas, mains electrics, structural work or asbestos. For those only, briefly tell the homeowner not to attempt the work themselves.",
    "Do not ask for, estimate or mention prices.",
    "Reply with JSON only.",
  ].join("\n");
}

export function normaliseJobSuggestion(
  value: unknown,
  trades: JobHelperTrade[],
): JobSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  const title = typeof parsed["title"] === "string" ? parsed["title"].trim().slice(0, 80) : "";
  const description =
    typeof parsed["description"] === "string" ? parsed["description"].trim().slice(0, 600) : "";
  if (!title || description.length < 60) return null;

  const suppliedSlug = typeof parsed["trade_slug"] === "string" ? parsed["trade_slug"].trim() : "";
  const tradeSlug = trades.some((trade) => trade.slug === suppliedSlug) ? suppliedSlug : null;
  const questions = Array.isArray(parsed["questions_to_add"])
    ? parsed["questions_to_add"]
        .filter((question): question is string => typeof question === "string")
        .map((question) => question.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const safetyNote =
    typeof parsed["safety_note"] === "string" && parsed["safety_note"].trim()
      ? parsed["safety_note"].trim().slice(0, 400)
      : null;

  return {
    trade_slug: tradeSlug,
    title,
    description,
    questions_to_add: questions,
    safety_note: safetyNote,
  };
}

export async function generateJobSuggestion(
  text: string,
  trades: JobHelperTrade[],
): Promise<JobSuggestion | null> {
  const apiKey = aiApiKey();
  if (!apiKey || trades.length === 0) return null;

  const provider = aiProvider();
  const model = provider === "gemini" ? aiModel("google/gemini-2.5-flash") : "openai/gpt-5.6-sol";
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(trades) },
    { role: "user", content: text },
  ];
  const started = Date.now();
  const controller = new AbortController();
  const signal =
    typeof AbortSignal.any === "function"
      ? AbortSignal.any([controller.signal, AbortSignal.timeout(AI_ATTEMPT_TIMEOUT_MS)])
      : controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new JobHelperTimeoutError());
    }, AI_ATTEMPT_TIMEOUT_MS);
  });

  try {
    const request = fetch(aiChatUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...aiAuthHeaders(apiKey) },
      body: JSON.stringify(buildJobHelperBody(messages)),
      signal,
    });
    const response = await Promise.race([request, timeout]);
    if (!response.ok) {
      let body = "";
      try {
        body = (await response.text()).slice(0, 500);
      } catch {
        // Ignore an unreadable provider error body.
      }
      console.error("[job-helper] provider error", {
        provider,
        model,
        status: response.status,
        body,
      });
      return null;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = (json.choices?.[0]?.message?.content ?? "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    if (!content.trim()) return null;
    try {
      return normaliseJobSuggestion(JSON.parse(content) as unknown, trades);
    } catch {
      console.error("[job-helper] JSON parse failed", { provider, model });
      return null;
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (
      error instanceof JobHelperTimeoutError ||
      name === "TimeoutError" ||
      name === "AbortError"
    ) {
      console.error("[job-helper] timeout", {
        provider,
        model,
        ms: Date.now() - started,
      });
    } else {
      console.error("[job-helper] request failed", {
        provider,
        model,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const JOB_HELPER_RATE_LIMIT = {
  prefix: "qa:job-helper",
  limit: 5,
  windowSeconds: 3600,
} as const;

export async function jobHelperRateLimited(
  client: SupabaseClient<Database>,
  fingerprint: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("hit_rate_limit", {
    p_bucket: `${JOB_HELPER_RATE_LIMIT.prefix}:${fingerprint}`,
    p_limit: JOB_HELPER_RATE_LIMIT.limit,
    p_window_seconds: JOB_HELPER_RATE_LIMIT.windowSeconds,
  });
  if (error || typeof data !== "boolean") throw new Error("job_helper_rate_limit_unavailable");
  return data === false;
}
