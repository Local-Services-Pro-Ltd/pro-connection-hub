import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RATING_FIELDS, type Ratings } from "@/lib/after-job.shared";

/**
 * Review moderation, firm replies and firm reports.
 *
 * Reviews are read and decided with the service role after an admin check, so
 * reviewer details never reach a browser that isn't an admin's. A firm sees
 * only its own published reviews, can post one reply (moderated) and can ask
 * us to look again at a review it believes breaks the rules.
 */

const SITE = "https://tradesmanfinder.org";

export type ReviewStatus = "pending" | "published" | "rejected";

export type AdminReview = {
  id: string;
  pro_id: string;
  company: string;
  author_name: string;
  author_place: string | null;
  rating: number;
  title: string | null;
  body: string;
  job_type: string | null;
  status: ReviewStatus;
  created_at: string;
  verified_job: boolean;
  ratings: Partial<Ratings>;
  job_reference: string | null;
  reported_at: string | null;
  report_reason: string | null;
  moderation_note: string | null;
  reply: { id: string; body: string; status: ReviewStatus } | null;
};

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The job-linked review columns are newer than the generated database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function requireAdmin(context: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ratingsOf(row: any): Partial<Ratings> {
  return Object.fromEntries(
    RATING_FIELDS.filter((field) => row[field.key]).map((field) => [field.key, row[field.key]]),
  );
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
    console.error("[reviews] email failed", {
      template,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/* ----------------------------------------------------------------- admin */

export const adminListReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminReview[]> => {
    await requireAdmin(context);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load reviews.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = (rows ?? []) as any[];
    if (!reviews.length) return [];
    const ids = reviews.map((row) => row.id as string);
    const [{ data: pros }, { data: replies }, { data: jobs }] = await Promise.all([
      db
        .from("pros")
        .select("id, company")
        .in("id", [...new Set(reviews.map((row) => row.pro_id))]),
      db.from("review_replies").select("id, review_id, body, status").in("review_id", ids),
      db
        .from("jobs")
        .select("id, reference")
        .in("id", reviews.map((row) => row.job_id).filter(Boolean)),
    ]);
    const names = new Map(
      ((pros ?? []) as { id: string; company: string }[]).map((pro) => [pro.id, pro.company]),
    );
    const replyBy = new Map(
      (
        (replies ?? []) as { id: string; review_id: string; body: string; status: ReviewStatus }[]
      ).map((reply) => [reply.review_id, reply]),
    );
    const refBy = new Map(
      ((jobs ?? []) as { id: string; reference: string }[]).map((job) => [job.id, job.reference]),
    );
    return reviews.map((row) => {
      const reply = replyBy.get(row.id);
      return {
        id: row.id,
        pro_id: row.pro_id,
        company: names.get(row.pro_id) ?? row.pro_id,
        author_name: row.author_name,
        author_place: row.author_place,
        rating: row.rating,
        title: row.title,
        body: row.body,
        job_type: row.job_type,
        status: row.status,
        created_at: row.created_at,
        verified_job: Boolean(row.verified_job),
        ratings: ratingsOf(row),
        job_reference: row.job_id ? (refBy.get(row.job_id) ?? null) : null,
        reported_at: row.reported_at,
        report_reason: row.report_reason,
        moderation_note: row.moderation_note,
        reply: reply ? { id: reply.id, body: reply.body, status: reply.status } : null,
      };
    });
  });

export const adminModerateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; note?: string }) => {
    const id = (input.id ?? "").trim();
    if (!id) throw new Error("Choose a review.");
    if (!["published", "rejected", "pending"].includes(input.status))
      throw new Error("Unknown decision.");
    return {
      id,
      status: input.status as ReviewStatus,
      note: (input.note ?? "").trim().slice(0, 1000),
    };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await adminDb();
    const { data: row, error } = await db
      .from("reviews")
      .update({
        status: data.status,
        moderated_at: new Date().toISOString(),
        // Deciding a review also settles any report against it.
        reported_at: null,
        ...(data.note ? { moderation_note: data.note } : {}),
      })
      .eq("id", data.id)
      .select("id, status, pro_id, rating")
      .maybeSingle();
    if (error || !row) throw new Error("Could not save that decision.");
    if (row.status === "published") {
      const { data: firm } = await db
        .from("pros")
        .select("company, contact_email")
        .eq("id", row.pro_id)
        .maybeSingle();
      await send(
        "review-published",
        firm?.contact_email,
        { company: firm?.company, rating: row.rating, dashboardUrl: `${SITE}/dashboard` },
        `review-published:${row.id}`,
      );
    }
    return { id: row.id as string, status: row.status as ReviewStatus };
  });

export const adminModerateReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => {
    if (!["published", "rejected"].includes(input.status)) throw new Error("Unknown decision.");
    const id = (input.id ?? "").trim();
    if (!id) throw new Error("Choose a reply.");
    return { id, status: input.status as "published" | "rejected" };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await adminDb();
    const { data: row, error } = await db
      .from("review_replies")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id, status")
      .maybeSingle();
    if (error || !row) throw new Error("Could not save that decision.");
    return { id: row.id as string, status: row.status as ReviewStatus };
  });

/* ------------------------------------------------------------------ firm */

export type FirmReview = {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  job_type: string | null;
  created_at: string;
  verified_job: boolean;
  ratings: Partial<Ratings>;
  reported: boolean;
  reply: { body: string; status: ReviewStatus } | null;
};

async function myFirmId(userId: string): Promise<string> {
  const db = await adminDb();
  const { data } = await db.from("pros").select("id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("No firm is linked to this account.");
  return data.id as string;
}

/** The firm's published reviews. Unpublished reviews are never shown to the firm. */
export const listMyReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FirmReview[]> => {
    const proId = await myFirmId(context.userId);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("reviews")
      .select("*")
      .eq("pro_id", proId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load your reviews.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = (rows ?? []) as any[];
    if (!reviews.length) return [];
    const { data: replies } = await db
      .from("review_replies")
      .select("review_id, body, status")
      .in(
        "review_id",
        reviews.map((row) => row.id),
      );
    const replyBy = new Map(
      ((replies ?? []) as { review_id: string; body: string; status: ReviewStatus }[]).map(
        (reply) => [reply.review_id, reply],
      ),
    );
    return reviews.map((row) => {
      const reply = replyBy.get(row.id);
      return {
        id: row.id,
        author_name: row.author_name,
        rating: row.rating,
        title: row.title,
        body: row.body,
        job_type: row.job_type,
        created_at: row.created_at,
        verified_job: Boolean(row.verified_job),
        ratings: ratingsOf(row),
        reported: Boolean(row.reported_at),
        reply: reply ? { body: reply.body, status: reply.status } : null,
      };
    });
  });

/** One public reply per review, checked by an admin before it appears. */
export const replyToMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string; body: string }) => {
    const body = (input.body ?? "").trim();
    if (body.length < 10) throw new Error("Please write a slightly longer reply.");
    return { reviewId: (input.reviewId ?? "").trim(), body: body.slice(0, 1500) };
  })
  .handler(async ({ data, context }) => {
    const proId = await myFirmId(context.userId);
    const db = await adminDb();
    const { data: review } = await db
      .from("reviews")
      .select("id")
      .eq("id", data.reviewId)
      .eq("pro_id", proId)
      .eq("status", "published")
      .maybeSingle();
    if (!review) throw new Error("We couldn't find that review.");
    const { error } = await db
      .from("review_replies")
      .insert({ review_id: review.id, pro_id: proId, body: data.body });
    if (error) {
      if (error.code === "23505") throw new Error("You have already replied to this review.");
      throw new Error("We couldn't save your reply. Please try again.");
    }
    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: "A firm has replied to a review",
      intro: "The reply stays hidden until you publish it.",
      path: "/admin/reviews",
      actionLabel: "Check reviews",
      dedupeKey: `review-reply:${review.id}`,
    });
    return { ok: true as const };
  });

/** The firm asks us to look again at a review it believes breaks the rules. */
export const reportMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reviewId: string; reason: string }) => {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 20)
      throw new Error("Please explain which review rule you think this breaks.");
    return { reviewId: (input.reviewId ?? "").trim(), reason: reason.slice(0, 1000) };
  })
  .handler(async ({ data, context }) => {
    const proId = await myFirmId(context.userId);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("reviews")
      .update({ reported_at: new Date().toISOString(), report_reason: data.reason })
      .eq("id", data.reviewId)
      .eq("pro_id", proId)
      .eq("status", "published")
      .select("id");
    if (error || !(rows ?? []).length) throw new Error("We couldn't find that review.");
    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: "A firm has reported a review",
      intro:
        "The review stays published while you decide. The published rules say we decide within 10 working days and tell both sides.",
      path: "/admin/reviews",
      actionLabel: "Check reviews",
      dedupeKey: `review-report:${data.reviewId}:${new Date().toISOString().slice(0, 10)}`,
    });
    return { ok: true as const };
  });
