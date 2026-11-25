/**
 * Tells firms when a checked document is about to expire, and when it has.
 * Run from the nightly job. Each stage is sent once per expiry date:
 *   1 = thirty days before, 2 = seven days before, 3 = the day after it expired.
 * Server only.
 */

const SITE = "https://tradesmanfinder.org";

export type ReminderCounts = { sent: number; failed: number };

function stageFor(daysLeft: number): 0 | 1 | 2 | 3 {
  if (daysLeft < 0) return 3;
  if (daysLeft <= 7) return 2;
  if (daysLeft <= 30) return 1;
  return 0;
}

export async function sendCredentialExpiryReminders(now = new Date()): Promise<ReminderCounts> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const counts: ReminderCounts = { sent: 0, failed: 0 };
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const lookBack = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);

  // Anything with an expiry date in the window that has not had its final notice.
  const { data: rows, error } = await db
    .from("pro_credentials")
    .select("id, pro_id, label, expires_on, expiry_reminder_stage, verified, verified_at")
    .not("expires_on", "is", null)
    .not("verified_at", "is", null)
    .gte("expires_on", lookBack)
    .lte("expires_on", horizon)
    .lt("expiry_reminder_stage", 3)
    .limit(200);
  if (error) throw new Error(`credential reminders: ${error.message}`);

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  for (const row of (rows ?? []) as {
    id: string;
    pro_id: string;
    label: string;
    expires_on: string;
    expiry_reminder_stage: number;
  }[]) {
    const expiry = row.expires_on.slice(0, 10);
    const daysLeft = Math.round(
      (new Date(`${expiry}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
        86_400_000,
    );
    const stage = stageFor(daysLeft);
    if (stage === 0 || stage <= row.expiry_reminder_stage) continue;

    const { data: firm } = await db
      .from("pros")
      .select("company, contact_email, user_id")
      .eq("id", row.pro_id)
      .maybeSingle();
    try {
      if (firm?.contact_email) {
        await sendTemplateEmail("credential-expiring", firm.contact_email, {
          templateData: {
            company: firm.company,
            label: row.label,
            expiresOn: new Date(`${expiry}T12:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }),
            daysLeft: Math.max(daysLeft, 0),
            expired: stage === 3,
            dashboardUrl: `${SITE}/dashboard`,
          },
          idempotencyKey: `credential-expiring:${row.id}:${expiry}:${stage}`,
        });
        counts.sent += 1;
      }
      // Record the stage even without an address, so we don't retry every night.
      await db.from("pro_credentials").update({ expiry_reminder_stage: stage }).eq("id", row.id);
    } catch (sendError) {
      counts.failed += 1;
      console.error("[credential-reminders] failed", {
        credentialId: row.id,
        message: sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  }
  return counts;
}
