/**
 * AI assistance for "Ask the Pros".
 *
 * One gateway call per submitted question produces:
 *  - a plainly-labelled first-pass answer for the homeowner,
 *  - safety gating for gas / electrical / structural / asbestos work,
 *  - auto-tagging (trade, urgency, tags) for routing and filtering,
 *  - a private moderation verdict for the admin review queue.
 *
 * The AI never publishes anything: a question still waits for a human, and
 * vetted pro answers always rank above the AI note in the UI.
 */

import { aiApiKey, aiAuthHeaders, aiChatUrl, aiProvider } from "@/lib/ai-provider";

/** Stable model id accepted by Gemini's OpenAI-compatible endpoint. */
export const GEMINI_QA_MODEL = "gemini-2.5-flash";

export type QaAiResult = {
  answer: string;
  safety: "none" | "caution" | "high";
  safety_note: string | null;
  tags: string[];
  urgency: string | null;
  suggested_trade: string | null;
  verdict: "publish" | "review" | "reject";
  risk: "low" | "medium" | "high";
  reasons: string[];
  summary: string | null;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description: "Practical first-pass guidance for a UK homeowner, 80-160 words, plain English.",
    },
    safety: { type: "string", enum: ["none", "caution", "high"] },
    safety_note: { type: ["string", "null"] },
    tags: { type: "array", items: { type: "string" } },
    urgency: { type: ["string", "null"], enum: ["emergency", "soon", "planned", null] },
    suggested_trade: { type: ["string", "null"] },
    verdict: { type: "string", enum: ["publish", "review", "reject"] },
    risk: { type: "string", enum: ["low", "medium", "high"] },
    reasons: { type: "array", items: { type: "string" } },
    summary: { type: ["string", "null"] },
  },
  required: [
    "answer",
    "safety",
    "safety_note",
    "tags",
    "urgency",
    "suggested_trade",
    "verdict",
    "risk",
    "reasons",
    "summary",
  ],
} as const;

/**
 * Gemini's OpenAI-compatible endpoint rejects union types (`["string","null"]`)
 * and `null` inside `enum`, so it gets nullable string fields and no `strict`.
 */
export const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    answer: SCHEMA.properties.answer,
    safety: SCHEMA.properties.safety,
    safety_note: { type: "string", nullable: true },
    tags: SCHEMA.properties.tags,
    urgency: { type: "string", nullable: true, enum: ["emergency", "soon", "planned"] },
    suggested_trade: { type: "string", nullable: true },
    verdict: SCHEMA.properties.verdict,
    risk: SCHEMA.properties.risk,
    reasons: SCHEMA.properties.reasons,
    summary: { type: "string", nullable: true },
  },
  required: SCHEMA.required,
};

type ChatMessage = { role: "system" | "user"; content: string };

export function buildGeminiBody(
  messages: ChatMessage[],
  mode: "schema" | "json_object" = "schema",
) {
  return {
    model: GEMINI_QA_MODEL,
    messages,
    response_format:
      mode === "json_object"
        ? { type: "json_object" }
        : { type: "json_schema", json_schema: { name: "qa_assist", schema: GEMINI_SCHEMA } },
  };
}

function systemPrompt(tradeSlugs: string[]) {
  return [
    "You assist a UK tradesman directory's public Q&A. You are NOT a tradesman and must never pretend to be one.",
    "",
    "Produce four things for the submitted homeowner question:",
    "1. answer — a helpful, honest first-pass in UK English: likely causes, what the homeowner can safely check, what a qualified tradesman would do, and rough UK cost ranges where genuinely useful. Never give step-by-step instructions for gas, mains electrical, structural or asbestos work — for those, explain why it must be a qualified/registered pro (Gas Safe, NICEIC/Part P, structural engineer, licensed asbestos removal). Keep it between 80 and 160 words. No sales pitch, no invented certifications, no personal opinions about named firms.",
    "2. safety — 'high' for gas, mains electrical, structural, asbestos, working at height or anything with injury/legal risk; 'caution' for damp, roofing, drainage, heating; otherwise 'none'. safety_note is one short sentence explaining the risk when safety is not 'none', else null.",
    "3. Routing — suggested_trade must be exactly one of these slugs or null: " +
      tradeSlugs.join(", ") +
      ". tags: 2-5 short lowercase topic tags. urgency: emergency, soon, planned, or null.",
    "4. Private moderation assist for our admins — verdict 'reject' if the post contains personal contact details, abuse, spam or an advertisement; 'review' if unclear, potentially defamatory or unusually risky; 'publish' if it is a genuine, safe-to-publish homeowner question. risk reflects moderation risk. reasons: short bullet reasons. summary: one sentence for the queue.",
    "",
    "Reply with JSON only, matching the provided schema.",
  ].join("\n");
}

export async function analyseQuestion(
  question: { title: string; body: string; trade?: string; area?: string },
  tradeSlugs: string[],
): Promise<QaAiResult | null> {
  const apiKey = aiApiKey();
  if (!apiKey) return null;

  const userText = [
    `Title: ${question.title}`,
    `Detail: ${question.body}`,
    question.trade ? `Homeowner picked trade: ${question.trade}` : "",
    question.area ? `Area: ${question.area}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const provider = aiProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(tradeSlugs) },
    { role: "user", content: userText },
  ];
  const post = (body: unknown) =>
    fetch(aiChatUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...aiAuthHeaders(apiKey) },
      body: JSON.stringify(body),
    });
  const logProviderError = async (res: Response, model: string) => {
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    console.error("[qa-ai] provider error", { provider, model, status: res.status, body });
  };

  let text = "";
  try {
    let res: Response;
    if (provider === "gemini") {
      res = await post(buildGeminiBody(messages, "schema"));
      if (res.status === 400) {
        await logProviderError(res, GEMINI_QA_MODEL);
        res = await post(buildGeminiBody(messages, "json_object"));
      }
      if (!res.ok) {
        await logProviderError(res, GEMINI_QA_MODEL);
        return null;
      }
    } else {
      // Lovable gateway path — unchanged.
      const model = "openai/gpt-5.6-sol";
      res = await post({
        model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "qa_assist", strict: true, schema: SCHEMA },
        },
      });
      if (!res.ok) {
        await logProviderError(res, model);
        return null;
      }
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    text = (json.choices?.[0]?.message?.content ?? "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");

    if (!text.trim()) return null;
    let parsed: QaAiResult;
    try {
      parsed = JSON.parse(text) as QaAiResult;
    } catch {
      console.error("[qa-ai] JSON parse failed", { provider, content: text.slice(0, 200) });
      return null;
    }
    return {
      answer: String(parsed.answer ?? "").slice(0, 4000),
      safety: ["none", "caution", "high"].includes(parsed.safety) ? parsed.safety : "none",
      safety_note: parsed.safety_note ? String(parsed.safety_note).slice(0, 400) : null,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 6).map((t) => String(t).slice(0, 40))
        : [],
      urgency: parsed.urgency ? String(parsed.urgency).slice(0, 40) : null,
      suggested_trade:
        parsed.suggested_trade && tradeSlugs.includes(parsed.suggested_trade)
          ? parsed.suggested_trade
          : null,
      verdict: ["publish", "review", "reject"].includes(parsed.verdict) ? parsed.verdict : "review",
      risk: ["low", "medium", "high"].includes(parsed.risk) ? parsed.risk : "low",
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.slice(0, 6).map((r) => String(r).slice(0, 200))
        : [],
      summary: parsed.summary ? String(parsed.summary).slice(0, 400) : null,
    };
  } catch (err) {
    console.error("[qa-ai] request failed", {
      provider,
      message: err instanceof Error ? err.message : String(err),
    });
    // AI assistance is best-effort — a failure must never lose the question.
    return null;
  }
}
