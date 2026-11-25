import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import {
  COMPLAINT_CATEGORIES,
  RATING_FIELDS,
  overallRating,
  type ComplaintCategory,
  type JobAfter,
  type Ratings,
  type ReviewDetail,
} from "@/lib/after-job.shared";

/**
 * After a firm is chosen: the homeowner marks the work complete, leaves a
 * review tied to that job, or reports a problem. All of it works from the
 * private job link, so a homeowner without an account can do it.
 *
 * Review rule enforced here: only the homeowner of the job, only for the firm
 * whose quote they accepted, only after they marked the work complete, and
 * once per job. Every review waits for an admin before it is published.
 */

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function limitByIp(scope: string, limit: number, windowSeconds: number) {
  const db = await adminDb();
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
  const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const { data: allowed, error } = await db.rpc("hit_rate_limit", {
    p_bucket: `${scope}:${ipKey}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (!error && allowed === false)
    throw new Error("That's a lot of requests in a short time. Please try again shortly.");
}

type JobRow = {
  id: string;
  reference: string;
  title: string;
  trade_slug: string;
  postcode: string;
  contact_name: string;
  contact_email: string;
};

async function jobFromLink(token: string): Promise<JobRow> {
  const { readJobLinkToken } = await import("@/lib/signed-links.server");
  const jobId = readJobLinkToken(token);
  if (!jobId)
    throw new Error("This link isn't valid. Please use the link in your confirmation email.");
  const db = await adminDb();
  const { data, error } = await db
    .from("jobs")
    .select("id, reference, title, trade_slug, postcode, contact_name, contact_email")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error("We couldn't load your job. Please try again.");
  if (!data) throw new Error("This job is no longer on TradesmanFinder.");
  return data as JobRow;
}

async function outcomeFor(jobId: string) {
  const db = await adminDb();
  const { data } = await db
    .from("job_outcomes")
    .select("pro_id, outcome, completed_at")
    .eq("job_id", jobId)
    .maybeSingle();
  return (data ?? null) as {
    pro_id: string | null;
    outcome: JobAfter["outcome"];
    completed_at: string | null;
  } | null;
}

async function send(
  template: string,
  to: string | null | undefined,
  templateData: Record<string, unknown>,
  key: string,
) {
  if (!to) return;
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail(template, to, { templateData, idempotencyKey: key });
  } catch (error) {
    console.error("[after-job] email failed", {
      template,
      key,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Where the job stands after a firm was chosen. */
export const getJobAfter = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data }): Promise<JobAfter> => {
    await limitByIp("job-after", 120, 600);
    const job = await jobFromLink(data.token);
    const db = await adminDb();
    const outcome = await outcomeFor(job.id);
    let chosen: JobAfter["chosen"] = null;
    if (outcome?.pro_id) {
      const { data: firm } = await db
        .from("pros")
        .select("id, company")
        .eq("id", outcome.pro_id)
        .maybeSingle();
      chosen = { pro_id: outcome.pro_id, company: firm?.company ?? "The firm you chose" };
    }
    const { data: review } = await db
      .from("reviews")
      .select("status")
      .eq("job_id", job.id)
      .limit(1)
      .maybeSingle();
    const { data: complaint } = await db
      .from("complaints")
      .select("reference, status")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      chosen,
      outcome: outcome?.outcome ?? null,
      completed_at: outcome?.completed_at ?? null,
      review: review ? { status: review.status } : null,
      complaint: complaint ? { reference: complaint.reference, status: complaint.status } : null,
    };
  });

/** Homeowner says the work is finished. This is what unlocks a review. */
export const markJobCompleted = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data }) => {
    await limitByIp("job-complete", 20, 3600);
    const job = await jobFromLink(data.token);
    const outcome = await outcomeFor(job.id);
    if (!outcome?.pro_id) throw new Error("Accept a quote first, then mark the work complete.");
    if (outcome.outcome === "completed") return { ok: true as const };
    const db = await adminDb();
    const now = new Date().toISOString();
    const { error } = await db
      .from("job_outcomes")
      .update({ outcome: "completed", completed_at: now, updated_at: now })
      .eq("job_id", job.id);
    if (error) throw new Error("We couldn't save that. Please try again.");
    await db.from("jobs").update({ status: "closed" }).eq("id", job.id);
    return { ok: true as const };
  });

export type ReviewInput = { token: string; ratings: Ratings; title?: string; body: string };

/** A review of the chosen firm for a completed job. Waits for an admin. */
export const submitJobReview = createServerFn({ method: "POST" })
  .inputValidator((input: ReviewInput) => {
    const ratings = {} as Ratings;
    for (const field of RATING_FIELDS) {
      const value = Math.round(Number(input.ratings?.[field.key]));
      if (!(value >= 1 && value <= 5)) throw new Error(`Give a rating for ${field.label}.`);
      ratings[field.key] = value;
    }
    const body = (input.body ?? "").trim();
    if (body.length < 20) throw new Error("Please write at least 20 characters about the job.");
    return {
      token: (input.token ?? "").trim(),
      ratings,
      title: (input.title ?? "").trim().slice(0, 120),
      body: body.slice(0, 2000),
    };
  })
  .handler(async ({ data }) => {
    await limitByIp("job-review", 10, 3600);
    const job = await jobFromLink(data.token);
    const outcome = await outcomeFor(job.id);
    if (!outcome?.pro_id || outcome.outcome !== "completed")
      throw new Error("You can review the firm once you have marked the work complete.");
    const db = await adminDb();
    const { data: trade } = await db
      .from("trades")
      .select("name")
      .eq("slug", job.trade_slug)
      .maybeSingle();
    const { postcodeDistrict } = await import("@/lib/job-interest.shared");
    const { data: row, error } = await db
      .from("reviews")
      .insert({
        pro_id: outcome.pro_id,
        job_id: job.id,
        author_id: null,
        // First name only; the surname is never stored on a review.
        author_name: (job.contact_name.trim().split(/\s+/)[0] ?? "Customer").slice(0, 40),
        author_place: postcodeDistrict(job.postcode) || null,
        job_type: trade?.name ?? null,
        rating: overallRating(data.ratings),
        ...data.ratings,
        title: data.title,
        body: data.body,
        verified_job: true,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("You have already reviewed this job.");
      console.error("[after-job] review insert failed", error);
      throw new Error("We couldn't save your review. Please try again.");
    }
    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: `New review to check: job ${job.reference}`,
      intro: "A homeowner has reviewed the firm they chose. It stays hidden until you publish it.",
      lines: [`Overall rating: ${overallRating(data.ratings)} out of 5`, `Job: ${job.reference}`],
      path: "/admin/reviews",
      actionLabel: "Check reviews",
      dedupeKey: `review:${row.id}`,
    });
    return { ok: true as const };
  });

export type ProblemInput = {
  token: string;
  category: string;
  description: string;
  desiredOutcome?: string;
};

/** Homeowner reports a problem with the firm they chose. */
export const reportJobProblem = createServerFn({ method: "POST" })
  .inputValidator((input: ProblemInput) => {
    const category = (input.category ?? "").trim();
    if (!COMPLAINT_CATEGORIES.some((item) => item.value === category))
      throw new Error("Choose what went wrong.");
    const description = (input.description ?? "").trim();
    if (description.length < 20)
      throw new Error("Please describe what happened in a little more detail.");
    return {
      token: (input.token ?? "").trim(),
      category: category as ComplaintCategory,
      description: description.slice(0, 4000),
      desiredOutcome: (input.desiredOutcome ?? "").trim().slice(0, 1500),
    };
  })
  .handler(async ({ data }) => {
    await limitByIp("job-problem", 5, 3600);
    const job = await jobFromLink(data.token);
    const outcome = await outcomeFor(job.id);
    if (!outcome?.pro_id)
      throw new Error("You can report a problem once you have chosen a firm for this job.");
    const db = await adminDb();
    const { data: open } = await db
      .from("complaints")
      .select("reference")
      .eq("job_id", job.id)
      .in("status", ["received", "firm_asked"])
      .limit(1)
      .maybeSingle();
    if (open)
      throw new Error(
        `We already have your report (${open.reference}) and are looking into it. Reply to our email to add to it.`,
      );
    const { data: row, error } = await db
      .from("complaints")
      .insert({
        job_id: job.id,
        job_reference: job.reference,
        pro_id: outcome.pro_id,
        category: data.category,
        description: data.description,
        desired_outcome: data.desiredOutcome,
        contact_name: job.contact_name,
        contact_email: job.contact_email,
      })
      .select("id, reference")
      .single();
    if (error) {
      console.error("[after-job] complaint insert failed", error);
      throw new Error("We couldn't save your report. Please try again.");
    }
    if (outcome.outcome === "hired") {
      await db
        .from("job_outcomes")
        .update({ outcome: "problem", updated_at: new Date().toISOString() })
        .eq("job_id", job.id);
    }
    const label = COMPLAINT_CATEGORIES.find((item) => item.value === data.category)?.label;
    await send(
      "complaint-received",
      job.contact_email,
      {
        contactName: job.contact_name.trim().split(/\s+/)[0],
        reference: row.reference,
        jobReference: job.reference,
        category: label,
      },
      `complaint-received:${row.id}`,
    );
    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: `Problem reported: job ${job.reference}`,
      intro:
        "A homeowner has reported a problem with a firm. The published process says we acknowledge within 2 working days.",
      lines: [`Reference: ${row.reference}`, `What went wrong: ${label}`],
      path: "/admin/complaints",
      actionLabel: "Open complaints",
      dedupeKey: `complaint:${row.id}`,
    });
    return { reference: row.reference as string };
  });

/** Sub-ratings, the verified-job flag and the firm's published reply for a firm's reviews. */
export const listReviewDetails = createServerFn({ method: "POST" })
  .inputValidator((input: { proId: string }) => {
    const proId = (input.proId ?? "").trim();
    if (!proId || proId.length > 120) throw new Error("Unknown firm.");
    return { proId };
  })
  .handler(async ({ data }): Promise<ReviewDetail[]> => {
    const db = await adminDb();
    const { data: rows } = await db
      .from("reviews")
      .select("id, verified_job, quality, punctuality, communication, cleanliness, price_accuracy")
      .eq("pro_id", data.proId)
      .eq("status", "published")
      .limit(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = (rows ?? []) as any[];
    if (!reviews.length) return [];
    const { data: replies } = await db
      .from("review_replies")
      .select("review_id, body")
      .eq("status", "published")
      .in(
        "review_id",
        reviews.map((row) => row.id),
      );
    const replyBy = new Map(
      ((replies ?? []) as { review_id: string; body: string }[]).map((reply) => [
        reply.review_id,
        reply.body,
      ]),
    );
    return reviews.map((row) => ({
      id: row.id,
      verified_job: Boolean(row.verified_job),
      ratings: Object.fromEntries(
        RATING_FIELDS.filter((field) => row[field.key]).map((field) => [field.key, row[field.key]]),
      ),
      reply: replyBy.get(row.id) ?? null,
    }));
  });
