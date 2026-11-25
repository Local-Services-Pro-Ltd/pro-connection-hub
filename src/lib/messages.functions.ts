import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MESSAGE_MAX, type JobMessage, type JobThread } from "@/lib/messages.shared";

/**
 * Messages between a homeowner and a firm they invited to quote.
 *
 * A conversation exists only where the homeowner invited the firm, and it
 * closes when that firm's quote is declined, withdrawn or expired, so a firm
 * that didn't get the job cannot keep writing. Homeowners act through their
 * private job link; firms through their account. The other side is emailed,
 * at most once every fifteen minutes per conversation.
 */

const SITE = "https://tradesmanfinder.org";
const OPEN_STATUSES = ["invited", "draft", "sent", "accepted"];

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function allow(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await adminDb();
  const { data, error } = await db.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return error ? true : data !== false;
}

function ipKey() {
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function cleanBody(value: string | undefined) {
  const body = (value ?? "").trim();
  if (!body) throw new Error("Write a message first.");
  if (body.length > MESSAGE_MAX) throw new Error(`Keep messages to ${MESSAGE_MAX} characters.`);
  return body;
}

type JobRow = {
  id: string;
  reference: string;
  title: string;
  contact_name: string;
  contact_email: string;
};

async function jobFromLink(token: string): Promise<JobRow> {
  const { readJobLinkToken } = await import("@/lib/signed-links.server");
  const jobId = readJobLinkToken(token);
  if (!jobId)
    throw new Error("This link isn't valid. Please use the link in your confirmation email.");
  const db = await adminDb();
  const { data } = await db
    .from("jobs")
    .select("id, reference, title, contact_name, contact_email")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) throw new Error("This job is no longer on TradesmanFinder.");
  return data as JobRow;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMessages(rows: any[], reader: "homeowner" | "firm"): JobMessage[] {
  return rows.map((row) => ({
    id: row.id,
    mine: row.sender === reader,
    body: row.body,
    created_at: row.created_at,
  }));
}

async function notify(
  to: string | null | undefined,
  templateData: Record<string, unknown>,
  threadKey: string,
) {
  if (!to) return;
  // One email per conversation and direction every fifteen minutes.
  if (!(await allow(`message-email:${threadKey}`, 1, 900))) return;
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("new-message", to, { templateData });
  } catch (error) {
    console.error("[messages] email failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/* ------------------------------------------------------------- homeowner */

/** Every conversation on the homeowner's job. Marks the firms' messages as read. */
export const listJobThreads = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data }): Promise<JobThread[]> => {
    const job = await jobFromLink(data.token);
    const db = await adminDb();
    const { data: quotes } = await db.from("quotes").select("pro_id, status").eq("job_id", job.id);
    const invited = (quotes ?? []) as { pro_id: string; status: string }[];
    if (!invited.length) return [];
    const [{ data: pros }, { data: rows }] = await Promise.all([
      db
        .from("pros")
        .select("id, company")
        .in(
          "id",
          invited.map((row) => row.pro_id),
        ),
      db
        .from("job_messages")
        .select("id, pro_id, sender, body, read_at, created_at")
        .eq("job_id", job.id)
        .order("created_at")
        .limit(500),
    ]);
    const names = new Map(
      ((pros ?? []) as { id: string; company: string }[]).map((pro) => [pro.id, pro.company]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    const unreadIds = all.filter((row) => row.sender === "firm" && !row.read_at).map((r) => r.id);
    const threads = invited.map((row) => {
      const mine = all.filter((message) => message.pro_id === row.pro_id);
      return {
        pro_id: row.pro_id,
        company: names.get(row.pro_id) ?? "A local firm",
        open: OPEN_STATUSES.includes(row.status),
        unread: mine.filter((message) => message.sender === "firm" && !message.read_at).length,
        messages: toMessages(mine, "homeowner"),
      };
    });
    if (unreadIds.length)
      await db
        .from("job_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    return threads;
  });

export const sendJobMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; proId: string; body: string }) => ({
    token: (input.token ?? "").trim(),
    proId: (input.proId ?? "").trim().slice(0, 120),
    body: cleanBody(input.body),
  }))
  .handler(async ({ data }) => {
    const job = await jobFromLink(data.token);
    if (
      !(await allow(`message:${job.id}`, 30, 3600)) ||
      !(await allow(`message-ip:${ipKey()}`, 60, 3600))
    )
      throw new Error("That's a lot of messages in a short time. Please try again shortly.");
    const db = await adminDb();
    const { data: quote } = await db
      .from("quotes")
      .select("status")
      .eq("job_id", job.id)
      .eq("pro_id", data.proId)
      .maybeSingle();
    if (!quote) throw new Error("You can message firms you have invited to quote.");
    if (!OPEN_STATUSES.includes(quote.status))
      throw new Error("This conversation is closed because that firm is no longer quoting.");
    const { error } = await db
      .from("job_messages")
      .insert({ job_id: job.id, pro_id: data.proId, sender: "homeowner", body: data.body });
    if (error) throw new Error("We couldn't send that message. Please try again.");
    const { data: firm } = await db
      .from("pros")
      .select("company, contact_email")
      .eq("id", data.proId)
      .maybeSingle();
    await notify(
      firm?.contact_email,
      {
        greeting: firm?.company,
        from: job.contact_name.trim().split(/\s+/)[0],
        reference: job.reference,
        title: job.title,
        snippet: data.body.slice(0, 300),
        url: `${SITE}/dashboard`,
        action: "Reply in your dashboard",
        where: "the Quotes tab of your dashboard",
      },
      `${job.id}:${data.proId}:to-firm`,
    );
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ firm */

async function myQuote(userId: string, quoteId: string) {
  const db = await adminDb();
  const { data: firm } = await db
    .from("pros")
    .select("id, company")
    .eq("user_id", userId)
    .maybeSingle();
  if (!firm) throw new Error("No firm is linked to this account.");
  const { data: quote } = await db
    .from("quotes")
    .select("id, job_id, status")
    .eq("id", quoteId)
    .eq("pro_id", firm.id)
    .maybeSingle();
  if (!quote) throw new Error("We couldn't find that job.");
  return { firm: firm as { id: string; company: string }, quote };
}

/** The firm's conversation for one job it was invited to. Marks the homeowner's messages read. */
export const listMyThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => ({ quoteId: (input.quoteId ?? "").trim() }))
  .handler(async ({ data, context }): Promise<{ open: boolean; messages: JobMessage[] }> => {
    const { firm, quote } = await myQuote(context.userId, data.quoteId);
    const db = await adminDb();
    const { data: rows } = await db
      .from("job_messages")
      .select("id, sender, body, read_at, created_at")
      .eq("job_id", quote.job_id)
      .eq("pro_id", firm.id)
      .order("created_at")
      .limit(500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    const unread = all.filter((row) => row.sender === "homeowner" && !row.read_at).map((r) => r.id);
    if (unread.length)
      await db.from("job_messages").update({ read_at: new Date().toISOString() }).in("id", unread);
    return { open: OPEN_STATUSES.includes(quote.status), messages: toMessages(all, "firm") };
  });

export const sendMyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string; body: string }) => ({
    quoteId: (input.quoteId ?? "").trim(),
    body: cleanBody(input.body),
  }))
  .handler(async ({ data, context }) => {
    const { firm, quote } = await myQuote(context.userId, data.quoteId);
    if (!OPEN_STATUSES.includes(quote.status))
      throw new Error("This conversation is closed because the job went to another firm.");
    if (!(await allow(`message-firm:${firm.id}`, 60, 3600)))
      throw new Error("That's a lot of messages in a short time. Please try again shortly.");
    const db = await adminDb();
    const { error } = await db
      .from("job_messages")
      .insert({ job_id: quote.job_id, pro_id: firm.id, sender: "firm", body: data.body });
    if (error) throw new Error("We couldn't send that message. Please try again.");
    const { data: job } = await db
      .from("jobs")
      .select("id, reference, title, contact_name, contact_email")
      .eq("id", quote.job_id)
      .maybeSingle();
    if (job) {
      const { jobLinkToken } = await import("@/lib/signed-links.server");
      await notify(
        job.contact_email,
        {
          greeting: (job.contact_name as string).trim().split(/\s+/)[0],
          from: firm.company,
          reference: job.reference,
          title: /https?:|www\.|\.[a-z]{2,}\//i.test(job.title) ? "" : job.title,
          snippet: data.body.slice(0, 300),
          url: `${SITE}/job-status?t=${encodeURIComponent(jobLinkToken(job.id))}`,
          action: "Read and reply",
          where: "your private job page",
        },
        `${job.id}:${firm.id}:to-homeowner`,
      );
    }
    return { ok: true as const };
  });

/** How many unread homeowner messages each of the firm's quotes has. */
export const myUnreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    const db = await adminDb();
    const { data: firm } = await db
      .from("pros")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!firm) return {};
    const { data: rows } = await db
      .from("job_messages")
      .select("job_id")
      .eq("pro_id", firm.id)
      .eq("sender", "homeowner")
      .is("read_at", null)
      .limit(500);
    const counts: Record<string, number> = {};
    for (const row of (rows ?? []) as { job_id: string }[])
      counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
    return counts;
  });
