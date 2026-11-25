import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_INVITES,
  quoteTotals,
  toPence,
  type FirmQuote,
  type QuoteInput,
  type QuoteItem,
  type QuoteStatus,
  type QuoteView,
} from "@/lib/quotes.shared";

/**
 * Structured quotes.
 *
 * Homeowners act through their private job link (they may have no account);
 * firms act through their signed-in account. The quote tables have no browser
 * access at all, so every rule here is the only way in:
 *   - a homeowner can invite at most three firms, and only firms that have
 *     registered interest in that job;
 *   - a firm sees the homeowner's contact details only once invited;
 *   - a firm can read and change only its own quotes;
 *   - VAT and totals are calculated here, never trusted from the browser.
 */

const SITE = "https://tradesmanfinder.org";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The quote tables are newer than the generated database types.
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
  description: string;
  trade_slug: string;
  postcode: string;
  timing: string;
  budget_band: string;
  contact_name: string;
  contact_email: string;
  status: string;
  photos?: string[] | null;
};

const JOB_COLUMNS =
  "id, reference, title, description, trade_slug, postcode, timing, budget_band, contact_name, contact_email, status, photos";

/** The job behind a homeowner's private link, or a clear error. */
async function jobFromLink(token: string): Promise<JobRow> {
  const { readJobLinkToken } = await import("@/lib/signed-links.server");
  const jobId = readJobLinkToken(token);
  if (!jobId)
    throw new Error("This link isn't valid. Please use the link in your confirmation email.");
  const db = await adminDb();
  const { data, error } = await db.from("jobs").select(JOB_COLUMNS).eq("id", jobId).maybeSingle();
  if (error) throw new Error("We couldn't load your job. Please try again.");
  if (!data) throw new Error("This job is no longer on TradesmanFinder.");
  return data as JobRow;
}

async function jobLink(jobId: string) {
  const { jobLinkToken } = await import("@/lib/signed-links.server");
  return `${SITE}/job-status?t=${encodeURIComponent(jobLinkToken(jobId))}`;
}

type FirmRow = { id: string; company: string; name: string; contact_email: string | null };

async function myFirm(userId: string): Promise<FirmRow> {
  const db = await adminDb();
  const { data } = await db
    .from("pros")
    .select("id, company, name, contact_email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("No firm is linked to this account.");
  return data as FirmRow;
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
    // The action is already saved; an email outage must not undo it.
    console.error("[quotes] email failed", {
      template,
      key,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function quoteView(row: any, company: string, items: QuoteItem[]): QuoteView {
  return {
    id: row.id,
    pro_id: row.pro_id,
    company,
    status: row.status as QuoteStatus,
    labour_pence: row.labour_pence,
    materials_pence: row.materials_pence,
    vat_registered: row.vat_registered,
    vat_pence: row.vat_pence,
    total_pence: row.total_pence,
    start_date: row.start_date,
    duration_days: row.duration_days,
    warranty: row.warranty,
    payment_schedule: row.payment_schedule,
    exclusions: row.exclusions,
    possible_extras: row.possible_extras,
    notes: row.notes,
    expires_on: row.expires_on,
    sent_at: row.sent_at,
    items,
  };
}

async function itemsFor(quoteIds: string[]): Promise<Map<string, QuoteItem[]>> {
  const map = new Map<string, QuoteItem[]>();
  if (!quoteIds.length) return map;
  const db = await adminDb();
  const { data } = await db
    .from("quote_items")
    .select("quote_id, kind, description, amount_pence, sort_order")
    .in("quote_id", quoteIds)
    .order("sort_order");
  for (const row of (data ?? []) as (QuoteItem & { quote_id: string })[]) {
    map.set(row.quote_id, [
      ...(map.get(row.quote_id) ?? []),
      { kind: row.kind, description: row.description, amount_pence: row.amount_pence },
    ]);
  }
  return map;
}

/**
 * The site promises a firm cannot quote until its checks are done. In practice
 * that means an admin has recorded and verified its public liability insurance
 * and the policy has not expired.
 */
async function quoteReadyFirms(proIds: string[]): Promise<Set<string>> {
  if (!proIds.length) return new Set();
  const db = await adminDb();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("pro_credentials")
    .select("pro_id, expires_on")
    .eq("kind", "insurance")
    .eq("verified", true)
    .in("pro_id", proIds);
  return new Set(
    ((data ?? []) as { pro_id: string; expires_on: string | null }[])
      .filter((row) => !row.expires_on || row.expires_on.slice(0, 10) >= today)
      .map((row) => row.pro_id),
  );
}

const NOT_READY = "This firm can't quote yet because we haven't finished checking its insurance.";

/* ------------------------------------------------------------- homeowner */

export type JobQuotes = {
  /** Firm ids the homeowner has invited, with where each invitation stands. */
  invited: { pro_id: string; company: string; status: QuoteStatus }[];
  /** Quotes the homeowner can read: sent, accepted or not chosen. */
  quotes: QuoteView[];
  invitesLeft: number;
  /** Interested firms whose insurance check is complete, so they can be invited. */
  quoteReady: string[];
  chosen: { pro_id: string; company: string; outcome: string } | null;
};

/** Everything about quotes for the private job page. Marks new quotes as seen. */
export const getJobQuotes = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: (input.token ?? "").trim() }))
  .handler(async ({ data }): Promise<JobQuotes> => {
    await limitByIp("job-quotes", 120, 600);
    const job = await jobFromLink(data.token);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("quotes")
      .select("*")
      .eq("job_id", job.id)
      .order("invited_at");
    if (error) throw new Error("We couldn't load your quotes. Please try again.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    const proIds = [...new Set(all.map((row) => row.pro_id as string))];
    const names = new Map<string, string>();
    if (proIds.length) {
      const { data: pros } = await db.from("pros").select("id, company").in("id", proIds);
      for (const pro of (pros ?? []) as { id: string; company: string }[])
        names.set(pro.id, pro.company);
    }
    const readable = all.filter((row) => ["sent", "accepted", "declined"].includes(row.status));
    const items = await itemsFor(readable.map((row) => row.id as string));

    const unseen = readable.filter((row) => row.status === "sent" && !row.viewed_at);
    if (unseen.length) {
      await db
        .from("quotes")
        .update({ viewed_at: new Date().toISOString() })
        .in(
          "id",
          unseen.map((row) => row.id),
        );
    }

    const { data: outcome } = await db
      .from("job_outcomes")
      .select("pro_id, outcome")
      .eq("job_id", job.id)
      .maybeSingle();

    const { data: interested } = await db
      .from("job_interest")
      .select("pro_id")
      .eq("job_id", job.id)
      .limit(50);
    const ready = await quoteReadyFirms(
      ((interested ?? []) as { pro_id: string }[]).map((row) => row.pro_id),
    );

    const active = all.filter((row) => row.status !== "withdrawn").length;
    return {
      quoteReady: [...ready],
      invited: all.map((row) => ({
        pro_id: row.pro_id,
        company: names.get(row.pro_id) ?? "A local firm",
        status: row.status,
      })),
      quotes: readable.map((row) =>
        quoteView(row, names.get(row.pro_id) ?? "A local firm", items.get(row.id) ?? []),
      ),
      invitesLeft: Math.max(MAX_INVITES - active, 0),
      chosen: outcome?.pro_id
        ? {
            pro_id: outcome.pro_id,
            company: names.get(outcome.pro_id) ?? "A local firm",
            outcome: outcome.outcome,
          }
        : null,
    };
  });

/** Homeowner invites an interested firm to quote. Shares their contact details with it. */
export const inviteToQuote = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; proId: string }) => {
    const proId = (input.proId ?? "").trim();
    if (!proId || proId.length > 120) throw new Error("Choose a firm to invite.");
    return { token: (input.token ?? "").trim(), proId };
  })
  .handler(async ({ data }) => {
    await limitByIp("quote-invite", 20, 3600);
    const job = await jobFromLink(data.token);
    if (job.status !== "open")
      throw new Error("This job already has a chosen firm, so no more firms can be invited.");
    const db = await adminDb();

    const { data: interest } = await db
      .from("job_interest")
      .select("id")
      .eq("job_id", job.id)
      .eq("pro_id", data.proId)
      .maybeSingle();
    if (!interest) throw new Error("You can invite firms that have said they are interested.");

    const { data: firm } = await db
      .from("pros")
      .select("id, company, name, contact_email, published, user_id")
      .eq("id", data.proId)
      .maybeSingle();
    if (!firm?.published || !firm.user_id)
      throw new Error("This firm can't receive invitations at the moment.");
    if (!(await quoteReadyFirms([data.proId])).has(data.proId)) throw new Error(NOT_READY);

    const { data: existing } = await db
      .from("quotes")
      .select("pro_id, status")
      .eq("job_id", job.id);
    const rows = (existing ?? []) as { pro_id: string; status: string }[];
    if (rows.some((row) => row.pro_id === data.proId)) return { ok: true as const };
    if (rows.filter((row) => row.status !== "withdrawn").length >= MAX_INVITES)
      throw new Error(`You can invite up to ${MAX_INVITES} firms to quote.`);

    const { data: created, error } = await db
      .from("quotes")
      .insert({ job_id: job.id, pro_id: data.proId, status: "invited" })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: true as const };
      console.error("[quotes] invite failed", error);
      throw new Error("We couldn't send that invitation. Please try again.");
    }

    await send(
      "quote-invited",
      firm.contact_email,
      {
        company: firm.company,
        reference: job.reference,
        title: job.title,
        contactName: job.contact_name,
        postcode: job.postcode,
        dashboardUrl: `${SITE}/dashboard`,
      },
      `quote-invited:${created.id}`,
    );
    return { ok: true as const };
  });

/** Homeowner accepts one quote. The other sent quotes are marked not chosen. */
export const decideQuote = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; quoteId: string; decision: string }) => {
    if (!["accept", "decline"].includes(input.decision)) throw new Error("Unknown decision.");
    const quoteId = (input.quoteId ?? "").trim();
    if (!quoteId) throw new Error("Choose a quote.");
    return {
      token: (input.token ?? "").trim(),
      quoteId,
      decision: input.decision as "accept" | "decline",
    };
  })
  .handler(async ({ data }) => {
    await limitByIp("quote-decide", 20, 3600);
    const job = await jobFromLink(data.token);
    const db = await adminDb();
    const { data: rows } = await db.from("quotes").select("*").eq("job_id", job.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    const quote = all.find((row) => row.id === data.quoteId);
    if (!quote) throw new Error("We couldn't find that quote.");
    if (quote.status !== "sent") throw new Error("This quote can no longer be changed.");
    if (all.some((row) => row.status === "accepted"))
      throw new Error("You have already accepted a quote for this job.");

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const { data: pros } = await db
      .from("pros")
      .select("id, company, contact_email")
      .in(
        "id",
        all.map((row) => row.pro_id),
      );
    const firms = new Map(
      ((pros ?? []) as { id: string; company: string; contact_email: string | null }[]).map(
        (pro) => [pro.id, pro],
      ),
    );
    const notify = async (row: { id: string; pro_id: string }, accepted: boolean) => {
      const firm = firms.get(row.pro_id);
      await send(
        "quote-decision",
        firm?.contact_email,
        {
          company: firm?.company,
          reference: job.reference,
          title: job.title,
          accepted,
          contactName: accepted ? job.contact_name : undefined,
          contactEmail: accepted ? job.contact_email : undefined,
          dashboardUrl: `${SITE}/dashboard`,
        },
        `quote-decision:${row.id}`,
      );
    };

    if (data.decision === "decline") {
      const { error } = await db
        .from("quotes")
        .update({ status: "declined", decided_at: now, updated_at: now })
        .eq("id", quote.id)
        .eq("status", "sent");
      if (error) throw new Error("We couldn't save that. Please try again.");
      await notify(quote, false);
      return { ok: true as const };
    }

    if (quote.expires_on && quote.expires_on < today)
      throw new Error("This quote has passed its valid-until date. Ask the firm for a new one.");

    const { data: accepted, error } = await db
      .from("quotes")
      .update({ status: "accepted", decided_at: now, updated_at: now })
      .eq("id", quote.id)
      .eq("status", "sent")
      .select("id");
    if (error || !(accepted ?? []).length)
      throw new Error("We couldn't accept that quote. Please try again.");

    await db.from("job_outcomes").upsert({
      job_id: job.id,
      pro_id: quote.pro_id,
      quote_id: quote.id,
      outcome: "hired",
      hired_at: now,
      updated_at: now,
    });
    await db.from("jobs").update({ status: "matched" }).eq("id", job.id);

    const others = all.filter((row) => row.id !== quote.id && row.status === "sent");
    if (others.length) {
      await db
        .from("quotes")
        .update({ status: "declined", decided_at: now, updated_at: now })
        .in(
          "id",
          others.map((row) => row.id),
        );
    }
    await notify(quote, true);
    for (const other of others) await notify(other, false);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ firm */

/** A signed-in homeowner's private links, so their account can open each job page. */
export const listMyJobLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ job_id: string; token: string }[]> => {
    const db = await adminDb();
    const { data } = await db.from("jobs").select("id").eq("user_id", context.userId).limit(200);
    const { jobLinkToken } = await import("@/lib/signed-links.server");
    return ((data ?? []) as { id: string }[]).map((job) => ({
      job_id: job.id,
      token: jobLinkToken(job.id),
    }));
  });

/** The firm's invitations and quotes, newest first. */
export const listMyQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FirmQuote[]> => {
    const firm = await myFirm(context.userId);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("quotes")
      .select("*")
      .eq("pro_id", firm.id)
      .order("invited_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load your quotes.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    if (!all.length) return [];
    const { data: jobs } = await db
      .from("jobs")
      .select(JOB_COLUMNS)
      .in(
        "id",
        all.map((row) => row.job_id),
      );
    const jobById = new Map(((jobs ?? []) as JobRow[]).map((job) => [job.id, job]));
    const items = await itemsFor(all.map((row) => row.id as string));
    const { signJobPhotos } = await import("@/lib/job-photos.server");
    const photosByJob = new Map<string, string[]>();
    for (const job of jobById.values())
      photosByJob.set(job.id, await signJobPhotos(job.id, job.photos));
    return all.flatMap((row) => {
      const job = jobById.get(row.job_id);
      if (!job) return [];
      // Contact details are shared from the invitation until the job goes elsewhere.
      const showContact = !["declined", "withdrawn", "expired"].includes(row.status);
      return [
        {
          ...quoteView(row, firm.company, items.get(row.id) ?? []),
          job_id: row.job_id,
          invited_at: row.invited_at,
          viewed_at: row.viewed_at,
          job: {
            reference: job.reference,
            title: job.title,
            description: job.description,
            timing: job.timing,
            budget_band: job.budget_band,
            postcode: showContact ? job.postcode : "",
            contact_name: showContact ? job.contact_name : "",
            contact_email: showContact ? job.contact_email : "",
            photos: photosByJob.get(job.id) ?? [],
          },
        },
      ];
    });
  });

function cleanText(value: string | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/** Save a draft, or send the quote to the homeowner. */
export const saveMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: QuoteInput) => {
    const quoteId = (input.quoteId ?? "").trim();
    if (!quoteId) throw new Error("Choose a quote.");
    const date = (value: string | null) => (value && ISO_DATE.test(value) ? value : null);
    const items = (input.items ?? [])
      .filter((item) => (item.description ?? "").trim())
      .slice(0, 20)
      .map((item) => ({
        kind: item.kind === "materials" ? ("materials" as const) : ("labour" as const),
        description: item.description.trim().slice(0, 200),
        amount_pence: toPence(Number(item.amount)),
      }));
    const duration = Math.round(Number(input.durationDays));
    return {
      quoteId,
      labour: toPence(Number(input.labour)),
      materials: toPence(Number(input.materials)),
      vatRegistered: input.vatRegistered === true,
      startDate: date(input.startDate),
      durationDays: Number.isFinite(duration) && duration >= 1 && duration <= 730 ? duration : null,
      warranty: cleanText(input.warranty, 500),
      paymentSchedule: cleanText(input.paymentSchedule, 800),
      exclusions: cleanText(input.exclusions, 1200),
      possibleExtras: cleanText(input.possibleExtras, 1200),
      notes: cleanText(input.notes, 1200),
      expiresOn: date(input.expiresOn),
      items,
      send: input.send === true,
    };
  })
  .handler(async ({ data, context }) => {
    const firm = await myFirm(context.userId);
    const db = await adminDb();
    const { data: quote } = await db
      .from("quotes")
      .select("id, job_id, status")
      .eq("id", data.quoteId)
      .eq("pro_id", firm.id)
      .maybeSingle();
    if (!quote) throw new Error("We couldn't find that quote.");
    if (!["invited", "draft", "sent"].includes(quote.status))
      throw new Error("This quote can no longer be changed.");

    // Line items, when given, are the amounts; otherwise the two totals are.
    const sum = (kind: string) =>
      data.items
        .filter((item) => item.kind === kind)
        .reduce((total, item) => total + item.amount_pence, 0);
    const hasLabourItems = data.items.some((item) => item.kind === "labour");
    const hasMaterialItems = data.items.some((item) => item.kind === "materials");
    const labour = hasLabourItems ? sum("labour") : data.labour;
    const materials = hasMaterialItems ? sum("materials") : data.materials;
    const totals = quoteTotals(labour, materials, data.vatRegistered);
    const today = new Date().toISOString().slice(0, 10);

    if (data.send) {
      if (!(await quoteReadyFirms([firm.id])).has(firm.id))
        throw new Error(
          "You can send quotes once we have checked your public liability insurance. Email your certificate to hello@tradesmanfinder.org.",
        );
      if (totals.net <= 0) throw new Error("Add your labour or materials price before sending.");
      if (!data.startDate) throw new Error("Add an estimated start date.");
      if (!data.durationDays) throw new Error("Add how many working days the job should take.");
      if (!data.paymentSchedule) throw new Error("Say how and when you expect to be paid.");
      if (!data.expiresOn || data.expiresOn < today)
        throw new Error("Add a valid-until date that is today or later.");
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from("quotes")
      .update({
        status: data.send ? "sent" : quote.status === "sent" ? "sent" : "draft",
        labour_pence: labour,
        materials_pence: materials,
        vat_registered: data.vatRegistered,
        vat_pence: totals.vat,
        total_pence: totals.total,
        start_date: data.startDate,
        duration_days: data.durationDays,
        warranty: data.warranty,
        payment_schedule: data.paymentSchedule,
        exclusions: data.exclusions,
        possible_extras: data.possibleExtras,
        notes: data.notes,
        expires_on: data.expiresOn,
        ...(data.send ? { sent_at: now, viewed_at: null } : {}),
        updated_at: now,
      })
      .eq("id", quote.id)
      .eq("pro_id", firm.id);
    if (error) {
      console.error("[quotes] save failed", error);
      throw new Error("We couldn't save your quote. Please try again.");
    }

    await db.from("quote_items").delete().eq("quote_id", quote.id);
    if (data.items.length) {
      await db.from("quote_items").insert(
        data.items.map((item, index) => ({
          quote_id: quote.id,
          kind: item.kind,
          description: item.description,
          amount_pence: item.amount_pence,
          sort_order: index,
        })),
      );
    }

    if (data.send) {
      const { data: job } = await db
        .from("jobs")
        .select("id, reference, title, contact_name, contact_email")
        .eq("id", quote.job_id)
        .maybeSingle();
      if (job) {
        await send(
          "quote-received",
          job.contact_email,
          {
            contactName: (job.contact_name as string).split(" ")[0],
            company: firm.company,
            reference: job.reference,
            title: /https?:|www\.|\.[a-z]{2,}\//i.test(job.title) ? "" : job.title,
            jobUrl: await jobLink(job.id),
          },
          `quote-received:${quote.id}:${now.slice(0, 13)}`,
        );
      }
    }
    return { id: quote.id as string, sent: data.send, total_pence: totals.total };
  });

/** The firm steps back from a job it was invited to. */
export const withdrawMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => ({ quoteId: (input.quoteId ?? "").trim() }))
  .handler(async ({ data, context }) => {
    const firm = await myFirm(context.userId);
    const db = await adminDb();
    const now = new Date().toISOString();
    const { data: rows, error } = await db
      .from("quotes")
      .update({ status: "withdrawn", decided_at: now, updated_at: now })
      .eq("id", data.quoteId)
      .eq("pro_id", firm.id)
      .in("status", ["invited", "draft", "sent"])
      .select("id");
    if (error || !(rows ?? []).length) throw new Error("This quote can no longer be withdrawn.");
    return { ok: true as const };
  });
