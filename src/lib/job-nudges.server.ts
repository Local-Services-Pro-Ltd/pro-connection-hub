/**
 * Nudges after a firm is chosen, sent once each from the nightly job:
 *   - "has the work finished?" a few days after the quoted work should be done
 *     (or three weeks after the firm was chosen when the quote gave no dates);
 *   - "please review the firm" two days after the homeowner marked it complete,
 *     if they have not reviewed.
 * Server only.
 */

const SITE = "https://tradesmanfinder.org";
const DAY = 86_400_000;

export async function sendJobNudges(now = new Date()): Promise<{ sent: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const counts = { sent: 0, failed: 0 };
  const { data: outcomes, error } = await db
    .from("job_outcomes")
    .select(
      "job_id, pro_id, quote_id, outcome, hired_at, completed_at, completion_nudged_at, review_requested_at",
    )
    .in("outcome", ["hired", "completed"])
    .or("completion_nudged_at.is.null,review_requested_at.is.null")
    .limit(200);
  if (error) throw new Error(`job nudges: ${error.message}`);

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const { jobLinkToken } = await import("@/lib/signed-links.server");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (outcomes ?? []) as any[]) {
    let stage: "finished" | "review" | null = null;
    if (row.outcome === "hired" && !row.completion_nudged_at) {
      let due = new Date(row.hired_at).getTime() + 21 * DAY;
      if (row.quote_id) {
        const { data: quote } = await db
          .from("quotes")
          .select("start_date, duration_days")
          .eq("id", row.quote_id)
          .maybeSingle();
        if (quote?.start_date && quote.duration_days) {
          // Working days are roughly 5 in every 7 calendar days; allow three days' grace.
          due =
            new Date(`${quote.start_date}T12:00:00Z`).getTime() +
            Math.ceil(quote.duration_days * 1.4 + 3) * DAY;
        }
      }
      if (now.getTime() >= due) stage = "finished";
    } else if (row.outcome === "completed" && !row.review_requested_at && row.completed_at) {
      if (now.getTime() >= new Date(row.completed_at).getTime() + 2 * DAY) {
        const { data: review } = await db
          .from("reviews")
          .select("id")
          .eq("job_id", row.job_id)
          .limit(1);
        if ((review ?? []).length) {
          // Already reviewed: record it so we stop looking at this job.
          await db
            .from("job_outcomes")
            .update({ review_requested_at: now.toISOString() })
            .eq("job_id", row.job_id);
          continue;
        }
        stage = "review";
      }
    }
    if (!stage) continue;

    try {
      const [{ data: job }, { data: firm }] = await Promise.all([
        db
          .from("jobs")
          .select("id, reference, contact_name, contact_email")
          .eq("id", row.job_id)
          .maybeSingle(),
        db.from("pros").select("company").eq("id", row.pro_id).maybeSingle(),
      ]);
      if (job?.contact_email && firm?.company) {
        await sendTemplateEmail("job-nudge", job.contact_email, {
          templateData: {
            contactName: (job.contact_name as string).trim().split(/\s+/)[0],
            company: firm.company,
            reference: job.reference,
            jobUrl: `${SITE}/job-status?t=${encodeURIComponent(jobLinkToken(job.id))}`,
            stage,
          },
          idempotencyKey: `job-nudge:${row.job_id}:${stage}`,
        });
        counts.sent += 1;
      }
      await db
        .from("job_outcomes")
        .update(
          stage === "finished"
            ? { completion_nudged_at: now.toISOString() }
            : { review_requested_at: now.toISOString() },
        )
        .eq("job_id", row.job_id);
    } catch (sendError) {
      counts.failed += 1;
      console.error("[job-nudges] failed", {
        jobId: row.job_id,
        message: sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  }
  return counts;
}
