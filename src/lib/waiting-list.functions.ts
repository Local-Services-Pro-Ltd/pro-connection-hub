import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";

export type WaitingListInput = {
  email: string;
  postcode: string;
  role: "homeowner" | "trader";
  trade?: string;
  source?: string;
  name?: string;
  phone?: string;
  note?: string;
  /** Signed challenge issued by getHumanCheck(). */
  checkToken: string;
  /** The visitor's answer to the challenge question. */
  checkAnswer: string;
  /** Honeypot — must stay empty; only bots fill hidden fields. */
  website?: string;
};

function clean(value: string | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Issues the arithmetic human check shown above the submit button. */
export const getHumanCheck = createServerFn({ method: "GET" }).handler(
  async () => {
    const { issueChallenge } = await import("@/lib/human-check.server");
    return issueChallenge();
  },
);

/**
 * Single entry point for waiting-list sign-ups (the /waiting-list page and the
 * out-of-area panel on /post-job both call this). Runs server-side so the
 * human check, rate limiting and confirmation email all happen in one trusted
 * place — the underlying database function is no longer callable from the
 * browser, so none of this can be side-stepped.
 */
export const submitWaitingList = createServerFn({ method: "POST" })
  .inputValidator((input: WaitingListInput) => {
    const email = (input.email ?? "").trim().toLowerCase();
    const postcode = (input.postcode ?? "").trim().toUpperCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new Error("Please enter a valid email address.");
    if (postcode.length < 2)
      throw new Error("Please enter a valid UK postcode.");
    if (input.role !== "homeowner" && input.role !== "trader")
      throw new Error("Please tell us whether you're a homeowner or a trade.");
    return {
      email,
      postcode,
      role: input.role,
      trade: clean(input.trade, 80),
      source: clean(input.source, 60) ?? "waiting_list_page",
      name: clean(input.name, 80),
      phone: clean(input.phone, 40),
      note: clean(input.note, 1000),
      checkToken: (input.checkToken ?? "").trim(),
      checkAnswer: (input.checkAnswer ?? "").trim(),
      website: (input.website ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    // 1. Honeypot. Bots fill every field they find; humans never see this one.
    if (data.website) {
      throw new Error("Something went wrong. Please try again.");
    }

    // 2. Human check.
    const { verifyChallenge } = await import("@/lib/human-check.server");
    verifyChallenge(data.checkToken, data.checkAnswer);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 3. Rate limit: per caller and per email address.
    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);

    const limits: Array<[string, number, number]> = [
      [`wl:ip:${ipKey}`, 5, 600], // 5 sign-ups per 10 minutes per visitor
      [`wl:email:${data.email}`, 3, 86_400], // 3 per email per day
    ];

    for (const [bucket, limit, windowSeconds] of limits) {
      const { data: allowed, error } = await supabaseAdmin.rpc(
        "hit_rate_limit",
        {
          p_bucket: bucket,
          p_limit: limit,
          p_window_seconds: windowSeconds,
        },
      );
      // A rate-limiter outage must not block genuine sign-ups.
      if (!error && allowed === false) {
        throw new Error(
          "That's a few requests in a short space of time. Please try again shortly.",
        );
      }
    }

    // 4. Record the sign-up.
    const { data: id, error } = await supabaseAdmin.rpc("add_to_waiting_list", {
      p_email: data.email,
      p_postcode: data.postcode,
      p_role: data.role,
      ...(data.trade ? { p_trade: data.trade } : {}),
      p_source: data.source ?? "waiting_list_page",
      ...(data.name ? { p_name: data.name } : {}),
      ...(data.phone ? { p_phone: data.phone } : {}),
      ...(data.note ? { p_note: data.note } : {}),
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("invalid_email"))
        throw new Error("Please enter a valid email address.");
      if (message.includes("invalid_postcode"))
        throw new Error("Please enter a valid UK postcode.");
      throw new Error("Something went wrong. Please try again.");
    }

    const outward = data.postcode.split(" ")[0] ?? data.postcode;

    // 5. Confirmation email (includes the manage-updates link).
    try {
      const mail = await import("@/lib/waiting-list-email.server");
      await mail.sendWaitingListConfirmation({
        email: data.email,
        name: data.name,
        postcode: data.postcode,
        role: data.role,
        id: String(id ?? ""),
      });
    } catch (mailError) {
      // A failed confirmation email must never lose the sign-up.
      console.error("[waiting-list] confirmation email failed", mailError);
    }

    return { id: String(id ?? ""), area: outward.replace(/\d/g, "") };
  });
