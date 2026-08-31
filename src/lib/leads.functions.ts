import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash, randomUUID } from "crypto";

/**
 * Direct enquiries ("leads") from a homeowner to one vetted firm found in the
 * directory. Runs server-side so the human check, rate limiting, firm lookup
 * and both confirmation emails happen in one trusted place — the browser
 * never learns a firm's contact address.
 */

export type LeadInput = {
  proId: string;
  name: string;
  email: string;
  phone?: string;
  postcode: string;
  message: string;
  budgetBand?: string;
  timing?: string;
  /** Signed challenge issued by getHumanCheck(). */
  checkToken: string;
  checkAnswer: string;
  /** Honeypot — must stay empty. */
  website?: string;
};

function clean(value: string | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export const sendProLead = createServerFn({ method: "POST" })
  .inputValidator((input: LeadInput) => {
    const email = (input.email ?? "").trim().toLowerCase();
    const name = (input.name ?? "").trim();
    const postcode = (input.postcode ?? "").trim().toUpperCase();
    const message = (input.message ?? "").trim();
    if (!input.proId) throw new Error("We couldn't tell which firm to contact.");
    if (name.length < 2) throw new Error("Please tell us your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new Error("Please enter a valid email address.");
    if (postcode.length < 2)
      throw new Error("Please enter the job's postcode.");
    if (message.length < 20)
      throw new Error(
        "Please describe the job in a little more detail (20 characters or more).",
      );
    return {
      proId: input.proId.slice(0, 120),
      name: name.slice(0, 80),
      email,
      phone: clean(input.phone, 40),
      postcode,
      message: message.slice(0, 2000),
      budgetBand: clean(input.budgetBand, 40),
      timing: clean(input.timing, 60),
      checkToken: (input.checkToken ?? "").trim(),
      checkAnswer: (input.checkAnswer ?? "").trim(),
      website: (input.website ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Honeypot — only bots fill a hidden field.
    if (data.website) {
      await supabaseAdmin
        .rpc("log_form_block", { p_form: "pro_lead", p_reason: "honeypot" })
        .then(undefined, () => undefined);
      throw new Error("Something went wrong. Please try again.");
    }

    // 2. Human check.
    const { verifyChallenge } = await import("@/lib/human-check.server");
    try {
      verifyChallenge(data.checkToken, data.checkAnswer);
    } catch (error) {
      await supabaseAdmin
        .rpc("log_form_block", { p_form: "pro_lead", p_reason: "human_check" })
        .then(undefined, () => undefined);
      throw error;
    }

    // 3. Rate limits, per visitor and per email address.
    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const limits: Array<[string, number, number]> = [
      [`lead:ip:${ipKey}`, 8, 900],
      [`lead:email:${data.email}`, 10, 86_400],
      [`lead:pair:${data.email}:${data.proId}`, 2, 86_400],
    ];
    for (const [bucket, limit, windowSeconds] of limits) {
      const { data: allowed, error } = await supabaseAdmin.rpc(
        "hit_rate_limit",
        { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds },
      );
      if (!error && allowed === false) {
        await supabaseAdmin
          .rpc("log_form_block", { p_form: "pro_lead", p_reason: "rate_limit" })
          .then(undefined, () => undefined);
        throw new Error(
          "You've sent a lot of enquiries just now. Please try again a little later.",
        );
      }
    }

    // 4. The firm must exist and be live in the directory.
    const { data: pro, error: proError } = await supabaseAdmin
      .from("pros")
      .select(
        "id, name, company, contact_email, trade_slug, response_mins, published",
      )
      .eq("id", data.proId)
      .maybeSingle();
    if (proError) throw new Error("We couldn't reach that firm just now.");
    if (!pro || !pro.published)
      throw new Error("That firm isn't taking enquiries at the moment.");

    const reference = `TFL-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    const { error: insertError } = await supabaseAdmin
      .from("pro_leads")
      .insert({
        pro_id: pro.id,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        postcode: data.postcode,
        trade_slug: pro.trade_slug,
        message: data.message,
        budget_band: data.budgetBand ?? null,
        timing: data.timing ?? null,
        reference,
        delivered_to_firm: Boolean(pro.contact_email),
      });
    if (insertError) {
      console.error("[lead] insert failed", insertError);
      throw new Error("We couldn't send that enquiry. Please try again.");
    }

    // 5. Confirmation to the homeowner, notification to the firm. A delivery
    // problem must never lose the lead — it is already recorded above.
    const { sendTemplateEmail } = await import(
      "@/lib/email-templates/send-email"
    );

    try {
      await sendTemplateEmail("lead-confirmation", data.email, {
        idempotencyKey: `lead-confirm-${reference}`,
        templateData: {
          name: data.name,
          company: pro.company,
          reference,
          message: data.message,
          responseMins: pro.response_mins,
        },
      });
    } catch (error) {
      console.error("[lead] homeowner confirmation failed", error);
    }

    if (pro.contact_email) {
      try {
        await sendTemplateEmail("lead-received", pro.contact_email, {
          idempotencyKey: `lead-firm-${reference}`,
          replyTo: data.email,
          templateData: {
            company: pro.company,
            customerName: data.name,
            customerEmail: data.email,
            customerPhone: data.phone,
            postcode: data.postcode,
            trade: pro.trade_slug,
            budget: data.budgetBand,
            timing: data.timing,
            message: data.message,
            reference,
          },
        });
      } catch (error) {
        console.error("[lead] firm notification failed", error);
      }
    }

    return {
      reference,
      company: pro.company,
      responseMins: pro.response_mins,
      routedToFirm: Boolean(pro.contact_email),
    };
  });
