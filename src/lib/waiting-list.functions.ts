import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type WaitingListInput = {
  email: string;
  postcode: string;
  role: "homeowner" | "trader";
  trade?: string;
  source?: string;
  name?: string;
  phone?: string;
  note?: string;
};

function clean(value: string | undefined, max: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * Single entry point for waiting-list sign-ups (the /waiting-list page and the
 * out-of-area panel on /post-job both call this). Runs server-side so the
 * confirmation email is sent from one trusted place rather than the browser.
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
    };
  })
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      key,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            if (
              key.startsWith("sb_") &&
              headers.get("Authorization") === `Bearer ${key}`
            ) {
              headers.delete("Authorization");
            }
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        },
      },
    );

    const { data: id, error } = await supabasePublic.rpc(
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

    const outward = data.postcode.split(" ")[0] ?? data.postcode;

    // Confirmation email: sent from here as soon as the sender domain is
    // verified. Keep the send in this handler so both sign-up surfaces get it.
    await sendConfirmation({
      email: data.email,
      name: data.name,
      postcode: data.postcode,
      role: data.role,
      id: String(id ?? ""),
    });

    return { id: String(id ?? ""), area: outward.replace(/\d/g, "") };
  });

async function sendConfirmation(payload: {
  email: string;
  name: string | undefined;
  postcode: string;
  role: "homeowner" | "trader";
  id: string;
}) {
  try {
    // The template registry only exists once the sender domain is set up.
    // Until then this resolves to nothing and the sign-up still succeeds.
    const mod = await import("./waiting-list-email.server").catch(() => null);
    await mod?.sendWaitingListConfirmation(payload);
  } catch (error) {
    // A failed confirmation email must never lose the sign-up.
    console.error("[waiting-list] confirmation email failed", error);
  }
}
