import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
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
 * Records a blocked attempt so the admin dashboard can show daily totals.
 * Never throws — monitoring must not interfere with the request.
 */
async function logBlock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  form: string,
  reason: string,
) {
  try {
    await admin.rpc("log_form_block", { p_form: form, p_reason: reason });
  } catch (error) {
    console.error("[waiting-list] block logging failed", error);
  }
}

function requestOrigin() {
  try {
    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host");
    return host ? `${proto}://${host}` : "https://tradesmanfinder.org";
  } catch {
    return "https://tradesmanfinder.org";
  }
}

/**
 * Single entry point for waiting-list sign-ups (the /waiting-list page and the
 * out-of-area panel on /post-job both call this). Runs server-side so the
 * human check, rate limiting, double opt-in and confirmation email all happen
 * in one trusted place — the underlying database function is not callable from
 * the browser, so none of this can be side-stepped.
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
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const form =
      data.source === "post_job_gate" ? "post_job_out_of_area" : "waiting_list";

    // 1. Honeypot. Bots fill every field they find; humans never see this one.
    if (data.website) {
      await logBlock(supabaseAdmin, form, "honeypot");
      throw new Error("Something went wrong. Please try again.");
    }

    // 2. Human check.
    const { verifyChallenge } = await import("@/lib/human-check.server");
    try {
      verifyChallenge(data.checkToken, data.checkAnswer);
    } catch (error) {
      await logBlock(supabaseAdmin, form, "human_check");
      throw error;
    }

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
        await logBlock(supabaseAdmin, form, "rate_limit");
        throw new Error(
          "That's a few requests in a short space of time. Please try again shortly.",
        );
      }
    }

    // 4. Record the sign-up (created unconfirmed, with a confirmation token).
    const { data: result, error } = await supabaseAdmin.rpc(
      "add_to_waiting_list",
      {
        p_email: data.email,
        p_postcode: data.postcode,
        p_role: data.role,
        ...(data.trade ? { p_trade: data.trade } : {}),
        p_source: data.source ?? "waiting_list_page",
        ...(data.name ? { p_name: data.name } : {}),
        ...(data.phone ? { p_phone: data.phone } : {}),
        ...(data.note ? { p_note: data.note } : {}),
      },
    );

    if (error) {
      const message = error.message ?? "";
      if (message.includes("invalid_email"))
        throw new Error("Please enter a valid email address.");
      if (message.includes("invalid_postcode"))
        throw new Error("Please enter a valid UK postcode.");
      throw new Error("Something went wrong. Please try again.");
    }

    const row = (result ?? {}) as {
      id?: string;
      token?: string;
      confirmed?: boolean;
    };
    const id = String(row.id ?? "");
    const outward = data.postcode.split(" ")[0] ?? data.postcode;
    const area = outward.replace(/\d/g, "");

    // Demand signal shown back to the visitor: how many confirmed sign-ups
    // already exist in their postcode area. Aggregate only.
    const waitingIn = async () => {
      try {
        const { data: total } = await supabaseAdmin.rpc(
          "waiting_list_area_total",
          { p_area: area },
        );
        return Number(total ?? 0);
      } catch {
        return 0;
      }
    };

    // Already confirmed on an earlier sign-up — nothing more to do.
    if (row.confirmed)
      return { id, area, pending: false, waiting: await waitingIn() };

    // 5. Double opt-in: the entry stays inactive until this link is clicked.
    const confirmUrl = `${requestOrigin()}/waiting-list/confirm?token=${encodeURIComponent(row.token ?? "")}`;
    const mail = await import("@/lib/waiting-list-email.server");
    const { sent } = await mail.sendWaitingListConfirmation({
      email: data.email,
      name: data.name,
      postcode: data.postcode,
      role: data.role,
      confirmUrl,
    });

    if (sent) {
      await supabaseAdmin.rpc("mark_waiting_list_email_sent", { p_id: id });
      return { id, area, pending: true, waiting: await waitingIn() };
    }

    // No sender configured yet: confirm on the visitor's behalf rather than
    // stranding a genuine sign-up in an unconfirmed state.
    await supabaseAdmin.rpc("confirm_waiting_list", {
      p_token: row.token ?? "",
    });
    return { id, area, pending: false, waiting: await waitingIn() };
  });

/** Completes double opt-in from the link in the confirmation email. */
export const confirmWaitingList = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({
    token: (input.token ?? "").trim().slice(0, 128),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: result, error } = await supabaseAdmin.rpc(
      "confirm_waiting_list",
      { p_token: data.token },
    );
    if (error) throw new Error("We couldn't confirm that link. Please retry.");
    const row = (result ?? {}) as {
      ok?: boolean;
      already?: boolean;
      postcode?: string;
    };
    return {
      ok: Boolean(row.ok),
      already: Boolean(row.already),
      postcode: row.postcode ?? "",
    };
  });

/**
 * Updates one person's email preferences. Gated by the secret token from
 * their confirmation link — no account needed, and no way to enumerate rows.
 * Platform-managed unsubscribe still applies on top of this.
 */
export const updateWaitingListPrefs = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      notifyLaunch: boolean;
      notifyUpdates: boolean;
    }) => ({
      token: (input.token ?? "").trim().slice(0, 128),
      notifyLaunch: Boolean(input.notifyLaunch),
      notifyUpdates: Boolean(input.notifyUpdates),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: result, error } = await supabaseAdmin.rpc(
      "waiting_list_set_prefs",
      {
        p_token: data.token,
        p_notify_launch: data.notifyLaunch,
        p_notify_updates: data.notifyUpdates,
      },
    );
    if (error) throw new Error("We couldn't save that. Please try again.");
    const row = (result ?? {}) as {
      ok?: boolean;
      notify_launch?: boolean;
      notify_updates?: boolean;
    };
    return {
      ok: Boolean(row.ok),
      notifyLaunch: Boolean(row.notify_launch),
      notifyUpdates: Boolean(row.notify_updates),
    };
  });

async function assertAdmin(context: {
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          a: string,
          b: string,
        ) => {
          eq: (
            a: string,
            b: string,
          ) => { maybeSingle: () => Promise<{ data: unknown }> };
        };
      };
    };
  };
  userId: string;
}) {
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Forbidden");
}

export type AreaWaiter = {
  id: string;
  email: string;
  name: string | null;
  postcode: string;
  role: string;
  queue_position: number;
  notify_launch: boolean;
  launch_notified_at: string | null;
};

/** Admin-only: who is waiting in a postcode area, with their queue position. */
export const listAreaWaiting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { area: string }) => ({
    area: (input.area ?? "").trim().toUpperCase().slice(0, 8),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.area) return [] as AreaWaiter[];
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: rows, error } = await supabaseAdmin.rpc(
      "waiting_list_area_recipients",
      { p_area: data.area },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []) as AreaWaiter[];
  });

/**
 * Admin-only: tells one waiting-list member their area has opened, including
 * their position in the queue. One trigger, one recipient — the admin sends
 * these individually from the dashboard as an area goes live.
 */
export const notifyAreaLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; areaName?: string }) => ({
    id: (input.id ?? "").trim(),
    areaName: (input.areaName ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.id) throw new Error("Missing sign-up id");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error } = await supabaseAdmin
      .from("waiting_list")
      .select("id, email, name, postcode, role, confirmed_at, notify_launch")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Sign-up not found");
    if (!row.confirmed_at) return { sent: false, reason: "unconfirmed" };
    if (!row.notify_launch) return { sent: false, reason: "opted_out" };

    const outward = row.postcode.split(" ")[0] ?? row.postcode;
    const area = outward.replace(/[^A-Z]/g, "");
    const { data: recipients } = await supabaseAdmin.rpc(
      "waiting_list_area_recipients",
      { p_area: area },
    );
    const position =
      ((recipients ?? []) as AreaWaiter[]).find((r) => r.id === row.id)
        ?.queue_position ?? 1;

    const origin =
      process.env["PUBLIC_SITE_URL"] ?? "https://www.tradesmanfinder.org";

    try {
      const { sendTemplateEmail } = await import(
        "@/lib/email-templates/send-email"
      );
      const result = await sendTemplateEmail(
        "waiting-list-area-live",
        row.email,
        {
          templateData: {
            ...(row.name ? { name: row.name } : {}),
            areaName: data.areaName || area,
            postcode: row.postcode,
            role: row.role,
            queuePosition: position,
            actionUrl:
              row.role === "trader"
                ? `${origin}/for-tradesmen`
                : `${origin}/post-job`,
          },
          idempotencyKey: `waiting-list-live-${row.id}-${area}`,
        },
      );
      if (result.sent) {
        await supabaseAdmin.rpc("waiting_list_mark_launch_notified", {
          p_id: row.id,
        });
      }
      return {
        sent: result.sent,
        reason: result.sent ? "sent" : "suppressed",
      };
    } catch (err) {
      console.error("[waiting-list] launch email failed", err);
      return { sent: false, reason: "send_failed" };
    }
  });
