/**
 * Emails the site admins when something is waiting for them. Server only.
 *
 * Recipients are every account with the admin role, unless ADMIN_ALERT_EMAILS
 * (comma separated) is set. An alert must never break the action that caused
 * it, so every failure is logged and swallowed.
 */

const SITE = "https://tradesmanfinder.org";

export type AdminAlert = {
  /** Email subject and heading. */
  subject: string;
  intro: string;
  /** Short "Label: value" facts. Keep homeowner contact details out. */
  lines?: string[];
  /** Admin page path, e.g. "/admin/applications". */
  path: string;
  actionLabel: string;
  /** Stops the same event emailing twice. */
  dedupeKey: string;
};

export async function adminRecipients(): Promise<string[]> {
  const configured = (process.env["ADMIN_ALERT_EMAILS"] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value));
  if (configured.length) return [...new Set(configured)];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(20);
  if (error) throw new Error(`admin lookup failed: ${error.message}`);
  const emails: string[] = [];
  for (const row of roles ?? []) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id as string);
    const email = data?.user?.email?.trim().toLowerCase();
    if (email) emails.push(email);
  }
  return [...new Set(emails)];
}

export async function notifyAdmins(alert: AdminAlert): Promise<number> {
  try {
    const recipients = await adminRecipients();
    if (!recipients.length) return 0;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    let sent = 0;
    for (const to of recipients) {
      try {
        const result = await sendTemplateEmail("admin-alert", to, {
          templateData: {
            subject: alert.subject,
            intro: alert.intro,
            lines: alert.lines ?? [],
            actionUrl: `${SITE}${alert.path}`,
            actionLabel: alert.actionLabel,
          },
          idempotencyKey: `admin-alert:${alert.dedupeKey}:${to}`,
        });
        if (result.sent) sent += 1;
      } catch (error) {
        console.error("[admin-alerts] send failed", {
          key: alert.dedupeKey,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return sent;
  } catch (error) {
    console.error("[admin-alerts] failed", {
      key: alert.dedupeKey,
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export type WaitingCounts = {
  applications: number;
  claims: number;
  gallery: number;
  projects: number;
  questions: number;
  answers: number;
  reviews: number;
  complaints: number;
};

/** What is waiting for an admin right now. */
export async function countWaiting(): Promise<WaitingCounts> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const count = async (
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: (query: any) => any,
  ): Promise<number> => {
    const { count: total, error } = await filter(
      db.from(table).select("id", { count: "exact", head: true }),
    );
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    return total ?? 0;
  };
  const waitingOnUs = ["pending", "in_review", "resubmitted"];
  const [applications, claims, gallery, projects, questions, answers, reviews, complaints] =
    await Promise.all([
      count("pro_applications", (q) => q.in("status", waitingOnUs).neq("kind", "claim")),
      count("pro_applications", (q) => q.in("status", waitingOnUs).eq("kind", "claim")),
      count("pro_projects", (q) => q.eq("status", "pending")),
      count("projects", (q) => q.eq("status", "pending")),
      count("questions", (q) => q.eq("status", "pending")),
      count("answers", (q) => q.eq("status", "pending")),
      count("reviews", (q) => q.eq("status", "pending")),
      count("complaints", (q) => q.in("status", ["received", "firm_asked"])),
    ]);
  return { applications, claims, gallery, projects, questions, answers, reviews, complaints };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One email a day listing everything still waiting. Sends nothing when the
 * queues are empty. Returns the number of emails sent.
 */
export async function sendDailyAdminSummary(now = new Date()): Promise<number> {
  try {
    const waiting = await countWaiting();
    const lines: string[] = [];
    if (waiting.applications)
      lines.push(
        `${plural(waiting.applications, "firm application", "firm applications")} to review`,
      );
    if (waiting.claims)
      lines.push(`${plural(waiting.claims, "listing claim", "listing claims")} to review`);
    if (waiting.gallery)
      lines.push(
        `${plural(waiting.gallery, "work gallery job", "work gallery jobs")} awaiting approval`,
      );
    if (waiting.projects)
      lines.push(`${plural(waiting.projects, "project posting", "project postings")} to review`);
    if (waiting.questions)
      lines.push(
        `${plural(waiting.questions, "Ask the Pros question", "Ask the Pros questions")} to moderate`,
      );
    if (waiting.answers)
      lines.push(
        `${plural(waiting.answers, "Ask the Pros answer", "Ask the Pros answers")} to moderate`,
      );
    if (waiting.reviews) lines.push(`${plural(waiting.reviews, "review", "reviews")} to check`);
    if (waiting.complaints)
      lines.push(`${plural(waiting.complaints, "complaint", "complaints")} still open`);
    if (!lines.length) return 0;
    const total = Object.values(waiting).reduce((sum, value) => sum + value, 0);
    return await notifyAdmins({
      subject: `${plural(total, "item is", "items are")} waiting for you on TradesmanFinder`,
      intro: "Here is what is still waiting for an admin today.",
      lines,
      path: "/admin",
      actionLabel: "Open the admin area",
      dedupeKey: `daily-summary:${now.toISOString().slice(0, 10)}`,
    });
  } catch (error) {
    console.error("[admin-alerts] daily summary failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
