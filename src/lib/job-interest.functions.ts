import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { firmJobView, type FirmJob } from "@/lib/job-interest.shared";
import type { JobInterestDatabase } from "@/lib/job-interest.types";

type InterestClient = SupabaseClient<JobInterestDatabase>;
type Firm = {
  id: string;
  name: string;
  company: string;
  trade_slug: string;
  area_slug: string | null;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function myPublishedFirm(client: InterestClient, userId: string): Promise<Firm | null> {
  const { data, error } = await client
    .from("pros")
    .select("id, name, company, trade_slug, area_slug")
    .eq("user_id", userId)
    .eq("published", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not check your firm profile.");
  return data;
}

async function liveAreaSlugs(client: InterestClient): Promise<string[]> {
  const { data, error } = await client.from("areas").select("slug").eq("status", "live");
  if (error) throw new Error("Could not check area coverage.");
  return (data ?? []).map((area) => area.slug);
}

async function firmCoversPostcode(
  client: InterestClient,
  firm: Firm,
  postcode: string,
  liveAreas: string[],
): Promise<boolean> {
  if (!firm.area_slug || !liveAreas.includes(firm.area_slug)) return false;
  const { data, error } = await client.rpc("area_slugs_for_postcode", { p: postcode });
  if (error) throw new Error("Could not check the job's area.");
  return (data ?? []).includes(firm.area_slug);
}

function isRecentOpenJob(job: { status: string; created_at: string }): boolean {
  return job.status === "open" && Date.now() - new Date(job.created_at).getTime() <= THIRTY_DAYS_MS;
}

export const listJobsForMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ jobs: FirmJob[]; reason?: "not_a_firm" }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as InterestClient;
    const firm = await myPublishedFirm(client, context.userId);
    if (!firm) return { jobs: [], reason: "not_a_firm" };

    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    // job_status currently contains open, matched and closed; only open jobs are available.
    const { data: rows, error } = await client
      .from("jobs")
      .select("id, reference, title, description, timing, budget_band, created_at, postcode")
      .eq("trade_slug", firm.trade_slug)
      .eq("status", "open")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load jobs near you.");
    if (!rows?.length) return { jobs: [] };

    const jobIds = rows.map((job) => job.id);
    const { data: existing, error: interestError } = await client
      .from("job_interest")
      .select("job_id")
      .eq("pro_id", firm.id)
      .in("job_id", jobIds);
    if (interestError) throw new Error("Could not check your job interest.");
    const interested = new Set((existing ?? []).map((row) => row.job_id));
    const liveAreas = await liveAreaSlugs(client);
    const { signJobPhotos } = await import("@/lib/job-photos.server");
    // The photos column is newer than the generated database types.
    const { data: photoRows } = await (
      supabaseAdmin as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            in: (
              column: string,
              values: string[],
            ) => Promise<{ data: { id: string; photos: string[] | null }[] | null }>;
          };
        };
      }
    )
      .from("jobs")
      .select("id, photos")
      .in("id", jobIds);
    const photoPaths = new Map((photoRows ?? []).map((row) => [row.id, row.photos ?? []]));
    const jobs: FirmJob[] = [];
    for (const row of rows) {
      if (await firmCoversPostcode(client, firm, row.postcode, liveAreas)) {
        const photos = await signJobPhotos(row.id, photoPaths.get(row.id));
        jobs.push(firmJobView(row, interested.has(row.id), photos));
      }
    }
    return { jobs };
  });

export const registerJobInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string; message?: string }) => {
    const jobId = (input.jobId ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      throw new Error("That job could not be found.");
    }
    const message = (input.message ?? "").trim();
    if (message.length > 600) throw new Error("Keep your note to 600 characters or fewer.");
    return { jobId, message };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as InterestClient;
    const firm = await myPublishedFirm(client, context.userId);
    if (!firm) throw new Error("Only a published firm can register interest.");

    const { data: job, error: jobError } = await client
      .from("jobs")
      .select("id, reference, trade_slug, status, created_at, postcode, contact_email")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jobError || !job) throw new Error("That job could not be found.");
    const liveAreas = await liveAreaSlugs(client);
    if (
      job.trade_slug !== firm.trade_slug ||
      !isRecentOpenJob(job) ||
      !(await firmCoversPostcode(client, firm, job.postcode, liveAreas))
    ) {
      throw new Error("This job is not available for your firm.");
    }

    const { data: allowed, error: limitError } = await client.rpc("hit_rate_limit", {
      p_bucket: `job-interest:${firm.id}`,
      p_limit: 20,
      p_window_seconds: 86_400,
    });
    if (limitError) throw new Error("Interest is unavailable right now. Please try again shortly.");
    if (allowed === false)
      throw new Error(
        "You've registered interest in several jobs today. Please try again tomorrow.",
      );

    const { error: insertError } = await client.from("job_interest").insert({
      job_id: job.id,
      pro_id: firm.id,
      message: data.message || null,
    });
    // The unique(job_id, pro_id) constraint makes repeat clicks idempotent.
    if (insertError?.code === "23505") return { ok: true as const };
    if (insertError) throw new Error("Could not register your interest. Please try again.");

    const { data: trade } = await client
      .from("trades")
      .select("name")
      .eq("slug", firm.trade_slug)
      .maybeSingle();
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const { jobLinkToken } = await import("@/lib/signed-links.server");
      await sendTemplateEmail("job-interest", job.contact_email, {
        templateData: {
          reference: job.reference,
          proName: firm.name,
          company: firm.company,
          trade: trade?.name ?? firm.trade_slug,
          vettingStatus: "Vetting in progress",
          profileUrl: `https://tradesmanfinder.org/pro/${encodeURIComponent(firm.id)}`,
          message: data.message || null,
          jobUrl: `https://tradesmanfinder.org/job-status?t=${encodeURIComponent(jobLinkToken(job.id))}`,
        },
        idempotencyKey: `job-interest:${job.id}:${firm.id}`,
      });
    } catch (error) {
      // The interest is already stored; an email outage must not roll it back.
      console.error("[job-interest] homeowner email failed", {
        jobId: job.id,
        proId: firm.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return { ok: true as const };
  });

export type HomeownerInterest = {
  job_id: string;
  pro_id: string;
  name: string;
  company: string;
  trade: string;
  message: string | null;
  created_at: string;
};

export const listInterestForMyJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ interests: HomeownerInterest[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as InterestClient;
    const { data: ownedJobs, error: jobsError } = await client
      .from("jobs")
      .select("id")
      .eq("user_id", context.userId)
      .limit(200);
    if (jobsError) throw new Error("Could not load interest in your jobs.");
    const jobIds = (ownedJobs ?? []).map((job) => job.id);
    if (!jobIds.length) return { interests: [] };

    const { data: rows, error } = await client
      .from("job_interest")
      .select("job_id, pro_id, message, created_at")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Could not load interest in your jobs.");
    const proIds = [...new Set((rows ?? []).map((row) => row.pro_id))];
    if (!proIds.length) return { interests: [] };
    const { data: pros, error: prosError } = await client
      .from("pros")
      .select("id, name, company, trade_slug")
      .in("id", proIds);
    if (prosError) throw new Error("Could not load interested firms.");
    const firms = new Map((pros ?? []).map((pro) => [pro.id, pro]));
    const interests = (rows ?? []).flatMap((row) => {
      const firm = firms.get(row.pro_id);
      return firm
        ? [
            {
              job_id: row.job_id,
              pro_id: row.pro_id,
              name: firm.name,
              company: firm.company,
              trade: firm.trade_slug,
              message: row.message,
              created_at: row.created_at,
            },
          ]
        : [];
    });
    return { interests };
  });
