import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";

/**
 * Certification applications from firms that want a TradesmanFinder listing.
 *
 * Anonymous firms submit through `submitProApplication`, which runs the same
 * spam gate as the waiting list (honeypot + signed human check + rate limit)
 * and writes through a SECURITY DEFINER function that the browser cannot call.
 * Reading and reviewing applications is admin-only.
 */

export type ProApplicationInput = {
  company: string;
  contactName: string;
  email: string;
  postcode: string;
  tradeSlug?: string;
  phone?: string;
  years?: number;
  website?: string;
  companiesHouse?: string;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  accreditations?: string;
  about?: string;
  checkToken: string;
  checkAnswer: string;
  /** Honeypot — must stay empty. */
  hp?: string;
};

function clean(value: string | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export const submitProApplication = createServerFn({ method: "POST" })
  .inputValidator((input: ProApplicationInput) => {
    const company = (input.company ?? "").trim();
    const contactName = (input.contactName ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    const postcode = (input.postcode ?? "").trim().toUpperCase();
    if (company.length < 2) throw new Error("Please enter your company name.");
    if (contactName.length < 2)
      throw new Error("Please enter the main contact's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new Error("Please enter a valid email address.");
    if (postcode.length < 2)
      throw new Error("Please enter the postcode you work from.");
    const expiry = clean(input.insuranceExpiry, 10);
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))
      throw new Error("Insurance expiry must be a valid date.");
    return {
      company: company.slice(0, 120),
      contactName: contactName.slice(0, 120),
      email,
      postcode,
      tradeSlug: clean(input.tradeSlug, 60),
      phone: clean(input.phone, 40),
      years: Math.max(0, Math.min(Number(input.years ?? 0) || 0, 80)),
      website: clean(input.website, 200),
      companiesHouse: clean(input.companiesHouse, 40),
      insuranceProvider: clean(input.insuranceProvider, 120),
      insuranceExpiry: expiry,
      accreditations: clean(input.accreditations, 500),
      about: clean(input.about, 2000) ?? "",
      checkToken: (input.checkToken ?? "").trim(),
      checkAnswer: (input.checkAnswer ?? "").trim(),
      hp: (input.hp ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const logBlock = async (reason: string) => {
      try {
        await supabaseAdmin.rpc("log_form_block", {
          p_form: "pro_application",
          p_reason: reason,
        });
      } catch (error) {
        console.error("[applications] block logging failed", error);
      }
    };

    if (data.hp) {
      await logBlock("honeypot");
      throw new Error("Something went wrong. Please try again.");
    }

    const { verifyChallenge } = await import("@/lib/human-check.server");
    try {
      verifyChallenge(data.checkToken, data.checkAnswer);
    } catch (error) {
      await logBlock("human_check");
      throw error;
    }

    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const limits: Array<[string, number, number]> = [
      [`app:ip:${ipKey}`, 4, 900],
      [`app:email:${data.email}`, 3, 86_400],
    ];
    for (const [bucket, limit, windowSeconds] of limits) {
      const { data: allowed, error } = await supabaseAdmin.rpc(
        "hit_rate_limit",
        { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds },
      );
      if (!error && allowed === false) {
        await logBlock("rate_limit");
        throw new Error(
          "That's a few applications in a short space of time. Please try again shortly.",
        );
      }
    }

    const { data: id, error } = await supabaseAdmin.rpc(
      "submit_pro_application",
      {
        p_company: data.company,
        p_contact_name: data.contactName,
        p_email: data.email,
        p_postcode: data.postcode,
        ...(data.tradeSlug ? { p_trade_slug: data.tradeSlug } : {}),
        ...(data.phone ? { p_phone: data.phone } : {}),
        p_years: data.years,
        ...(data.website ? { p_website: data.website } : {}),
        ...(data.companiesHouse
          ? { p_companies_house: data.companiesHouse }
          : {}),
        ...(data.insuranceProvider
          ? { p_insurance_provider: data.insuranceProvider }
          : {}),
        ...(data.insuranceExpiry
          ? { p_insurance_expiry: data.insuranceExpiry }
          : {}),
        ...(data.accreditations
          ? { p_accreditations: data.accreditations }
          : {}),
        p_about: data.about,
      },
    );

    if (error) {
      const message = error.message ?? "";
      if (message.includes("invalid_email"))
        throw new Error("Please enter a valid email address.");
      if (message.includes("invalid_postcode"))
        throw new Error("Please enter a valid UK postcode.");
      console.error("[applications] insert failed", error);
      throw new Error("Something went wrong. Please try again.");
    }

    return { id: String(id ?? "") };
  });

export type ProApplication = {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string | null;
  trade_slug: string | null;
  postcode: string;
  years: number;
  website: string | null;
  companies_house: string | null;
  insurance_provider: string | null;
  insurance_expiry: string | null;
  accreditations: string | null;
  about: string;
  status: string;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => unknown };
  userId: string;
}) {
  const { data, error } = (await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  })) as { data: boolean | null; error: unknown };
  if (error || !data) throw new Error("Admins only.");
}

/** Every application, newest first. Admin-only. */
export const listProApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("pro_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as ProApplication[];
  });

/** Move an application through the vetting pipeline. Admin-only. */
export const reviewProApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; note?: string }) => {
    const allowed = ["pending", "in_review", "approved", "rejected"];
    if (!allowed.includes(input.status)) throw new Error("Unknown status.");
    if (!input.id) throw new Error("Missing application.");
    return {
      id: input.id,
      status: input.status,
      note: (input.note ?? "").trim().slice(0, 500),
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("pro_applications")
      .update({
        status: data.status,
        reviewer_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
