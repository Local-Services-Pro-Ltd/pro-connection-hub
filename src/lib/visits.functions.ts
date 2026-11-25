import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Visit requests.
 *
 * A listed slot is booked by the existing `request_booking` database function,
 * which checks it against the firm's hours. This file adds what was missing
 * around it: the firm is emailed, the firm can accept or decline, the
 * homeowner is told, and a homeowner can suggest a time outside the listed
 * slots. A suggested time is only ever a request until the firm accepts it.
 */

const SITE = "https://tradesmanfinder.org";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Suggested times: at least a day ahead, within 30 days, 7am to 8pm UK time. */
const EARLIEST_HOUR = 7;
const LATEST_HOUR = 20;
const MAX_DAYS_AHEAD = 30;

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The visit decision columns are newer than the generated database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: pick("hour"), minute: pick("minute") };
}

function whenText(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

async function send(
  template: string,
  to: string | null | undefined,
  templateData: Record<string, unknown>,
  key: string,
) {
  if (!to) return false;
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail(template, to, { templateData, idempotencyKey: key });
    return result.sent;
  } catch (error) {
    console.error("[visits] email failed", {
      template,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

type BookingRow = {
  id: string;
  pro_id: string;
  reference: string;
  slot_start: string;
  contact_name: string;
  contact_email: string;
  postcode: string | null;
  notes: string;
  status: string;
  suggested_by_customer: boolean;
  created_at: string;
};

async function tellFirm(booking: BookingRow) {
  const db = await adminDb();
  const { data: firm } = await db
    .from("pros")
    .select("company, contact_email")
    .eq("id", booking.pro_id)
    .maybeSingle();
  await send(
    "visit-requested",
    firm?.contact_email,
    {
      company: firm?.company,
      when: whenText(booking.slot_start),
      suggested: booking.suggested_by_customer,
      contactName: booking.contact_name,
      postcode: booking.postcode,
      notes: booking.notes,
      reference: booking.reference,
      dashboardUrl: `${SITE}/dashboard`,
    },
    `visit-requested:${booking.id}`,
  );
}

/**
 * Called straight after a listed slot is booked from the browser. Knowing the
 * reference and the email it was booked with proves the caller made it.
 */
export const announceVisitRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { reference: string; email: string }) => ({
    reference: (input.reference ?? "").trim().toUpperCase().slice(0, 40),
    email: (input.email ?? "").trim().toLowerCase().slice(0, 254),
  }))
  .handler(async ({ data }) => {
    if (!data.reference || !EMAIL.test(data.email)) return { ok: false as const };
    const db = await adminDb();
    const { data: booking } = await db
      .from("bookings")
      .select("*")
      .eq("reference", data.reference)
      .eq("contact_email", data.email)
      .maybeSingle();
    if (!booking) return { ok: false as const };
    if (Date.now() - new Date(booking.created_at).getTime() > 15 * 60 * 1000)
      return { ok: false as const };
    await tellFirm(booking as BookingRow);
    return { ok: true as const };
  });

export type SuggestVisitInput = {
  proId: string;
  slotStart: string;
  name: string;
  email: string;
  phone?: string;
  postcode?: string;
  notes?: string;
};

/** Homeowner proposes a time that isn't one of the firm's listed slots. */
export const suggestVisitTime = createServerFn({ method: "POST" })
  .inputValidator((input: SuggestVisitInput) => {
    const proId = (input.proId ?? "").trim();
    if (!proId || proId.length > 120) throw new Error("Unknown firm.");
    const when = new Date(input.slotStart);
    if (Number.isNaN(when.getTime())) throw new Error("Choose a date and time.");
    const name = (input.name ?? "").trim();
    if (name.length < 2) throw new Error("Enter your name.");
    const email = (input.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new Error("Enter a valid email address.");
    return {
      proId,
      when,
      name: name.slice(0, 80),
      email: email.slice(0, 254),
      phone: (input.phone ?? "").trim().slice(0, 40),
      postcode: (input.postcode ?? "").trim().toUpperCase().slice(0, 10),
      notes: (input.notes ?? "").trim().slice(0, 2000),
    };
  })
  .handler(async ({ data }) => {
    const now = Date.now();
    if (data.when.getTime() < now + 20 * 60 * 60 * 1000)
      throw new Error("Please suggest a time at least a day ahead.");
    if (data.when.getTime() > now + MAX_DAYS_AHEAD * 86_400_000)
      throw new Error(`Please suggest a time within the next ${MAX_DAYS_AHEAD} days.`);
    const { hour, minute } = londonParts(data.when);
    if (hour < EARLIEST_HOUR || hour > LATEST_HOUR || (hour === LATEST_HOUR && minute > 0))
      throw new Error("Please suggest a time between 7am and 8pm.");
    if (minute % 30 !== 0) throw new Error("Please choose a time on the hour or half hour.");

    const db = await adminDb();
    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    for (const [bucket, limit] of [
      [`booking:${data.email}`, 5],
      [`booking-pro:${data.proId}`, 20],
      [`booking-ip:${ipKey}`, 10],
    ] as const) {
      const { data: allowed, error } = await db.rpc("hit_rate_limit", {
        p_bucket: bucket,
        p_limit: limit,
        p_window_seconds: 3600,
      });
      if (!error && allowed === false)
        throw new Error("Too many visit requests. Please try again later.");
    }

    const { data: firm } = await db
      .from("pros")
      .select("id, published")
      .eq("id", data.proId)
      .maybeSingle();
    if (!firm?.published) throw new Error("That firm isn't taking visit requests right now.");

    const slot = data.when.toISOString();
    const { data: clash } = await db
      .from("bookings")
      .select("id")
      .eq("pro_id", data.proId)
      .eq("slot_start", slot)
      .neq("status", "cancelled")
      .limit(1);
    if ((clash ?? []).length) throw new Error("Someone has already asked for that time.");

    const { data: booking, error } = await db
      .from("bookings")
      .insert({
        pro_id: data.proId,
        slot_start: slot,
        contact_name: data.name,
        contact_email: data.email,
        contact_phone: data.phone || null,
        postcode: data.postcode || null,
        notes: data.notes,
        status: "requested",
        suggested_by_customer: true,
      })
      .select("*")
      .single();
    if (error || !booking) {
      console.error("[visits] suggest failed", error);
      throw new Error("We couldn't send that request. Please try again.");
    }
    await tellFirm(booking as BookingRow);
    return { reference: booking.reference as string };
  });

/** The firm accepts or declines a visit request. The homeowner is emailed. */
export const decideVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; decision: string; note?: string }) => {
    if (!["accept", "decline"].includes(input.decision)) throw new Error("Unknown decision.");
    const bookingId = (input.bookingId ?? "").trim();
    if (!bookingId) throw new Error("Choose a visit.");
    return {
      bookingId,
      decision: input.decision as "accept" | "decline",
      note: (input.note ?? "").trim().slice(0, 600),
    };
  })
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: firm } = await db
      .from("pros")
      .select("id, company")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!firm) throw new Error("No firm is linked to this account.");
    const now = new Date().toISOString();
    const { data: rows, error } = await db
      .from("bookings")
      .update({
        status: data.decision === "accept" ? "confirmed" : "cancelled",
        decided_at: now,
        firm_note: data.note || null,
      })
      .eq("id", data.bookingId)
      .eq("pro_id", firm.id)
      .eq("status", "requested")
      .select("*");
    if (error) throw new Error("We couldn't save that. Please try again.");
    const booking = (rows ?? [])[0] as BookingRow | undefined;
    if (!booking) throw new Error("This request has already been answered.");
    const emailed = await send(
      "visit-decision",
      booking.contact_email,
      {
        contactName: booking.contact_name.split(" ")[0],
        company: firm.company,
        when: whenText(booking.slot_start),
        accepted: data.decision === "accept",
        note: data.note,
        reference: booking.reference,
        profileUrl: `${SITE}/pro/${encodeURIComponent(firm.id)}`,
      },
      `visit-decision:${booking.id}`,
    );
    return { ok: true as const, emailed };
  });
