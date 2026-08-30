import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";

/**
 * "Ask the Pros" — a moderated public Q&A. Homeowners post questions
 * anonymously (spam-gated), vetted published firms answer, and nothing appears
 * on the site until an admin publishes it. All writes run through the server so
 * the human check, rate limits and moderation state can't be side-stepped.
 */

export type AskQuestionInput = {
  title: string;
  body: string;
  trade?: string;
  name?: string;
  area?: string;
  checkToken: string;
  checkAnswer: string;
  /** Honeypot — must stay empty. */
  website?: string;
};

function clean(value: string | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function callerKey() {
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rateLimited(admin: any, bucket: string, limit: number, win: number) {
  const { data: allowed, error } = await admin.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: win,
  });
  // A limiter outage must never block a genuine post.
  return !error && allowed === false;
}

export const submitQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: AskQuestionInput) => {
    const title = (input.title ?? "").trim();
    const body = (input.body ?? "").trim();
    if (title.length < 10)
      throw new Error("Please give your question a fuller title.");
    if (body.length < 20)
      throw new Error("Please add a little more detail to your question.");
    return {
      title: title.slice(0, 160),
      body: body.slice(0, 4000),
      trade: clean(input.trade, 80),
      name: clean(input.name, 80),
      area: clean(input.area, 80),
      checkToken: (input.checkToken ?? "").trim(),
      checkAnswer: (input.checkAnswer ?? "").trim(),
      website: (input.website ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    if (data.website) throw new Error("Something went wrong. Please try again.");

    const { verifyChallenge } = await import("@/lib/human-check.server");
    verifyChallenge(data.checkToken, data.checkAnswer);

    if (await rateLimited(supabaseAdmin, `qa:ask:${callerKey()}`, 3, 900))
      throw new Error(
        "That's a few questions in a short space of time. Please try again shortly.",
      );

    const { data: questionId, error } = await supabaseAdmin.rpc("ask_question", {
      p_title: data.title,
      p_body: data.body,
      ...(data.trade ? { p_trade_slug: data.trade } : {}),
      ...(data.name ? { p_asker_name: data.name } : {}),
      ...(data.area ? { p_area: data.area } : {}),
    });

    if (error) throw new Error("Something went wrong. Please try again.");

    // Best-effort AI pass: labelled first answer, safety gating, auto-tags and
    // a private moderation suggestion. Never blocks or fails the submission.
    let ai: Awaited<ReturnType<typeof import("@/lib/qa-ai.server").analyseQuestion>> =
      null;
    try {
      const { analyseQuestion } = await import("@/lib/qa-ai.server");
      const { data: trades } = await supabaseAdmin.from("trades").select("slug");
      ai = await analyseQuestion(
        {
          title: data.title,
          body: data.body,
          ...(data.trade ? { trade: data.trade } : {}),
          ...(data.area ? { area: data.area } : {}),
        },
        (trades ?? []).map((t: { slug: string }) => t.slug),
      );
      if (ai && questionId) {
        await supabaseAdmin.rpc("set_question_ai", {
          p_question_id: questionId,
          p_answer: ai.answer,
          p_safety: ai.safety,
          p_safety_note: ai.safety_note ?? undefined,
          p_tags: ai.tags,
          p_urgency: ai.urgency ?? undefined,
          p_suggested_trade: ai.suggested_trade ?? undefined,
          p_verdict: ai.verdict,
          p_risk: ai.risk,
          p_reasons: ai.reasons,
          p_summary: ai.summary ?? undefined,
        });
      }
    } catch {
      ai = null;
    }

    return {
      pending: true as const,
      aiAnswer: ai?.answer ?? null,
      aiSafety: ai?.safety ?? "none",
      aiSafetyNote: ai?.safety_note ?? null,
    };
  });


export type AnswerInput = { questionId: string; body: string };

/** Only the signed-in owner of a published firm may answer; still moderated. */
export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AnswerInput) => {
    const body = (input.body ?? "").trim();
    if (body.length < 20)
      throw new Error("Please write a slightly fuller answer.");
    return { questionId: (input.questionId ?? "").trim(), body: body.slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    if (
      await rateLimited(supabaseAdmin, `qa:answer:${context.userId}`, 10, 3600)
    )
      throw new Error("Please slow down a little and try again shortly.");

    const { error } = await supabaseAdmin.rpc("answer_question", {
      p_question_id: data.questionId,
      p_user_id: context.userId,
      p_body: data.body,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("not_a_published_pro"))
        throw new Error("Only vetted, published firms can answer questions.");
      if (message.includes("already_answered"))
        throw new Error("You've already answered this question.");
      if (message.includes("question_not_available"))
        throw new Error("That question is no longer open for answers.");
      throw new Error("Something went wrong. Please try again.");
    }
    return { pending: true as const };
  });

export type ModerationTarget = "question" | "answer";

/** Admin moderation queue: pending questions and answers awaiting review. */
export const listPendingQa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const [questions, answers, reviews] = await Promise.all([
      context.supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("answers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase.from("question_ai_reviews").select("*").limit(200),
    ]);

    return {
      questions: questions.data ?? [],
      answers: answers.data ?? [],
      reviews: reviews.data ?? [],
    };
  });


export const moderateQa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { target: ModerationTarget; id: string; status: "published" | "rejected" }) => ({
      target: input.target === "answer" ? ("answer" as const) : ("question" as const),
      id: (input.id ?? "").trim(),
      status: input.status === "rejected" ? ("rejected" as const) : ("published" as const),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const table = data.target === "answer" ? "answers" : "questions";
    const { error } = await context.supabase
      .from(table)
      .update({
        status: data.status,
        published_at: data.status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
