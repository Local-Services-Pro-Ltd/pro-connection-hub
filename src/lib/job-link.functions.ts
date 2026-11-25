import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";

/**
 * Homeowners can post a job without an account, so they get a confirmation
 * email with a private, signed link to a page showing their job, the firms
 * matched to it and any firm that has registered interest.
 */

const SITE = "https://tradesmanfinder.org";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A confirmation can only be requested straight after posting. */
const FRESH_MS = 15 * 60 * 1000;

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

async function tradeName(slug: string | null) {
  if (!slug) return "";
  const db = await adminDb();
  const { data } = await db.from("trades").select("name").eq("slug", slug).maybeSingle();
  return (data?.name as string | undefined) ?? slug.replaceAll("-", " ");
}

/**
 * Called by the post-a-job form straight after the job is saved. The browser
 * chooses the job id, so knowing it proves the caller just posted that job.
 * The email only ever goes to the address stored on the job, the job's own
 * posting limits have already applied, and each job is confirmed once.
 */
export const confirmJobPosted = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string }) => {
    const jobId = (input.jobId ?? "").trim().toLowerCase();
    if (!UUID.test(jobId)) throw new Error("We couldn't find that job.");
    return { jobId };
  })
  .handler(async ({ data }) => {
    await limitByIp("job-confirm", 10, 3600);
    const db = await adminDb();
    const { data: job, error } = await db
      .from("jobs")
      .select("id, reference, title, trade_slug, postcode, contact_name, contact_email, created_at")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error || !job) return { sent: false as const };
    if (Date.now() - new Date(job.created_at as string).getTime() > FRESH_MS)
      return { sent: false as const };

    const trade = await tradeName(job.trade_slug as string | null);
    const { jobLinkToken } = await import("@/lib/signed-links.server");
    let sent = false;
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("job-posted", job.contact_email as string, {
        templateData: {
          contactName: (job.contact_name as string | null)?.split(" ")[0] ?? "",
          reference: job.reference,
          // The title is typed by whoever posted; never relay a web address by email.
          title: /https?:|www\.|\.[a-z]{2,}\//i.test(job.title as string) ? "" : job.title,
          trade,
          postcode: job.postcode,
          jobUrl: `${SITE}/job-status?t=${encodeURIComponent(jobLinkToken(job.id as string))}`,
        },
        idempotencyKey: `job-posted:${job.id}`,
      });
      sent = result.sent;
    } catch (emailError) {
      console.error("[job-link] confirmation email failed", {
        jobId: job.id,
        message: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    const { postcodeDistrict } = await import("@/lib/job-interest.shared");
    const { notifyAdmins } = await import("@/lib/admin-alerts.server");
    await notifyAdmins({
      subject: `New job posted: ${job.title}`,
      intro:
        "A homeowner has posted a job. Firms covering that trade can see it under Jobs near you.",
      lines: [
        `Reference: ${job.reference}`,
        `Trade: ${trade}`,
        `Area: ${postcodeDistrict(job.postcode as string)}`,
      ],
      path: "/admin",
      actionLabel: "Open the admin area",
      dedupeKey: `job-posted:${job.id}`,
    });
    return { sent };
  });

export type LinkedJob = {
  reference: string;
  title: string;
  description: string;
  trade_slug: string;
  trade: string;
  postcode: string;
  timing: string;
  budget_band: string;
  status: string;
  created_at: string;
  /** Short-lived links to the photos the homeowner added. */
  photos: string[];
  interests: {
    pro_id: string;
    company: string;
    name: string;
    message: string | null;
    created_at: string;
  }[];
};

/** The private job page behind the emailed link. Never returns contact details. */
export const getJobByLink = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data }): Promise<LinkedJob> => {
    await limitByIp("job-link", 60, 600);
    const { readJobLinkToken } = await import("@/lib/signed-links.server");
    const jobId = readJobLinkToken(data.token);
    const missing = "This link isn't valid. Please use the link in your confirmation email.";
    if (!jobId) throw new Error(missing);

    const db = await adminDb();
    const { data: job, error } = await db
      .from("jobs")
      .select(
        "id, reference, title, description, trade_slug, postcode, timing, budget_band, status, created_at, photos",
      )
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new Error("We couldn't load your job. Please try again.");
    if (!job) throw new Error("This job is no longer on TradesmanFinder.");

    const { data: rows } = await db
      .from("job_interest")
      .select("pro_id, message, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(50);
    const proIds = [...new Set(((rows ?? []) as { pro_id: string }[]).map((row) => row.pro_id))];
    const firms = new Map<string, { company: string; name: string }>();
    if (proIds.length) {
      const { data: pros } = await db
        .from("pros")
        .select("id, company, name")
        .in("id", proIds)
        .eq("published", true);
      for (const pro of (pros ?? []) as { id: string; company: string; name: string }[])
        firms.set(pro.id, { company: pro.company, name: pro.name });
    }

    return {
      reference: job.reference,
      title: job.title,
      description: job.description,
      trade_slug: job.trade_slug,
      trade: await tradeName(job.trade_slug),
      postcode: job.postcode,
      timing: job.timing,
      budget_band: job.budget_band,
      status: job.status,
      created_at: job.created_at,
      photos: await (await import("@/lib/job-photos.server")).signJobPhotos(jobId, job.photos),
      interests: (
        (rows ?? []) as { pro_id: string; message: string | null; created_at: string }[]
      ).flatMap((row) => {
        const firm = firms.get(row.pro_id);
        return firm ? [{ ...row, company: firm.company, name: firm.name }] : [];
      }),
    };
  });
