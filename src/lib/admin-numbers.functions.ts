import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The admin "Numbers" page: supply, demand and how far jobs get, counted
 * straight from the database. No cookies or third-party analytics. Example
 * listings, and anything attached to them, are left out.
 */

export type Numbers = {
  generatedAt: string;
  supply: {
    listed: number;
    withAccount: number;
    canQuote: number;
    invitedNotJoined: number;
    /** Firms that can quote, by area and trade. */
    coverage: { area: string; trade: string; listed: number; canQuote: number }[];
  };
  demand: { jobsTotal: number; jobs7: number; jobs30: number; waitingList: number };
  funnel: {
    jobs: number;
    withInterest: number;
    withInvite: number;
    withQuote: number;
    accepted: number;
    completed: number;
    reviewed: number;
  };
  quality: {
    quotesPerQuotedJob: number | null;
    medianHoursToFirstQuote: number | null;
    reviewsPublished: number;
    averageRating: number | null;
    complaintsTotal: number;
    complaintsOpen: number;
    complaintsPer100Completed: number | null;
    averageDaysToResolve: number | null;
  };
};

const DAY = 86_400_000;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export const adminNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Numbers> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Several of these tables are newer than the generated database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = async (query: any): Promise<any[]> => {
      const { data, error } = await query;
      if (error) throw new Error(`Numbers could not be loaded: ${error.message}`);
      return data ?? [];
    };

    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const [
      pros,
      credentials,
      trades,
      jobs,
      interest,
      quotes,
      outcomes,
      reviews,
      complaints,
      waiting,
    ] = await Promise.all([
      rows(
        db
          .from("pros")
          .select("id, trade_slug, area, published, is_demo, user_id, invited_at")
          .limit(5000),
      ),
      rows(
        db
          .from("pro_credentials")
          .select("pro_id, expires_on")
          .eq("kind", "insurance")
          .eq("verified", true)
          .limit(5000),
      ),
      rows(db.from("trades").select("slug, name")),
      rows(db.from("jobs").select("id, created_at").limit(10000)),
      rows(db.from("job_interest").select("job_id, pro_id").limit(20000)),
      rows(db.from("quotes").select("job_id, pro_id, status, sent_at").limit(20000)),
      rows(db.from("job_outcomes").select("job_id, pro_id, outcome").limit(10000)),
      rows(db.from("reviews").select("job_id, pro_id, rating, status").limit(10000)),
      rows(db.from("complaints").select("pro_id, status, created_at, updated_at").limit(10000)),
      db.from("waiting_list").select("id", { count: "exact", head: true }),
    ]);

    const demo = new Set(pros.filter((pro) => pro.is_demo).map((pro) => pro.id as string));
    const real = pros.filter((pro) => !pro.is_demo && pro.published);
    const insured = new Set(
      credentials
        .filter((row) => !row.expires_on || String(row.expires_on).slice(0, 10) >= today)
        .map((row) => row.pro_id as string),
    );
    const canQuote = (pro: { id: string; user_id: string | null }) =>
      Boolean(pro.user_id) && insured.has(pro.id);
    const tradeName = new Map(trades.map((trade) => [trade.slug as string, trade.name as string]));

    const coverage = new Map<
      string,
      { area: string; trade: string; listed: number; canQuote: number }
    >();
    for (const pro of real) {
      const area = (pro.area as string | null) ?? "Unknown";
      const trade = tradeName.get(pro.trade_slug) ?? pro.trade_slug ?? "Unknown";
      const key = `${area}|${trade}`;
      const cell = coverage.get(key) ?? { area, trade, listed: 0, canQuote: 0 };
      cell.listed += 1;
      if (canQuote(pro)) cell.canQuote += 1;
      coverage.set(key, cell);
    }

    // Leave out anything that only involved an example listing.
    const realQuotes = quotes.filter((quote) => !demo.has(quote.pro_id));
    const realInterest = interest.filter((row) => !demo.has(row.pro_id));
    const realOutcomes = outcomes.filter((row) => !row.pro_id || !demo.has(row.pro_id));
    const realReviews = reviews.filter((row) => !demo.has(row.pro_id));
    const realComplaints = complaints.filter((row) => !row.pro_id || !demo.has(row.pro_id));

    const jobIds = (list: { job_id: string }[]) => new Set(list.map((row) => row.job_id));
    const sent = realQuotes.filter((quote) =>
      ["sent", "accepted", "declined", "expired"].includes(quote.status),
    );
    const quotedJobs = jobIds(sent);
    const completed = realOutcomes.filter((row) => row.outcome === "completed");
    const created = new Map(jobs.map((job) => [job.id as string, job.created_at as string]));
    const firstQuote = new Map<string, number>();
    for (const quote of sent) {
      if (!quote.sent_at) continue;
      const at = new Date(quote.sent_at).getTime();
      const current = firstQuote.get(quote.job_id);
      if (current === undefined || at < current) firstQuote.set(quote.job_id, at);
    }
    const hoursToFirst = [...firstQuote.entries()].flatMap(([jobId, at]) => {
      const posted = created.get(jobId);
      return posted ? [(at - new Date(posted).getTime()) / 3_600_000] : [];
    });
    const published = realReviews.filter((review) => review.status === "published");
    const closed = realComplaints.filter((row) => ["resolved", "closed"].includes(row.status));
    const medianHours = median(hoursToFirst);

    return {
      generatedAt: new Date(now).toISOString(),
      supply: {
        listed: real.length,
        withAccount: real.filter((pro) => pro.user_id).length,
        canQuote: real.filter(canQuote).length,
        invitedNotJoined: real.filter((pro) => pro.invited_at && !pro.user_id).length,
        coverage: [...coverage.values()].sort(
          (a, b) => a.area.localeCompare(b.area) || a.trade.localeCompare(b.trade),
        ),
      },
      demand: {
        jobsTotal: jobs.length,
        jobs7: jobs.filter((job) => now - new Date(job.created_at).getTime() <= 7 * DAY).length,
        jobs30: jobs.filter((job) => now - new Date(job.created_at).getTime() <= 30 * DAY).length,
        waitingList: waiting.count ?? 0,
      },
      funnel: {
        jobs: jobs.length,
        withInterest: jobIds(realInterest).size,
        withInvite: jobIds(realQuotes).size,
        withQuote: quotedJobs.size,
        accepted: realOutcomes.length,
        completed: completed.length,
        reviewed: jobIds(realReviews.filter((review) => review.job_id)).size,
      },
      quality: {
        quotesPerQuotedJob: quotedJobs.size ? round1(sent.length / quotedJobs.size) : null,
        medianHoursToFirstQuote: medianHours === null ? null : round1(medianHours),
        reviewsPublished: published.length,
        averageRating: published.length
          ? round1(published.reduce((sum, review) => sum + review.rating, 0) / published.length)
          : null,
        complaintsTotal: realComplaints.length,
        complaintsOpen: realComplaints.length - closed.length,
        complaintsPer100Completed: completed.length
          ? round1((realComplaints.length / completed.length) * 100)
          : null,
        averageDaysToResolve: closed.length
          ? round1(
              closed.reduce(
                (sum, row) =>
                  sum +
                  (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / DAY,
                0,
              ) / closed.length,
            )
          : null,
      },
    };
  });
