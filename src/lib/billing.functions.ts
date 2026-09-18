import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Stripe membership billing for tradespeople.
 *
 * Runs entirely server-side: the secret key never reaches the browser, and the
 * `pros` row is only ever updated from what Stripe itself reports, never from
 * a client-supplied success redirect.
 */

/** Live price IDs, created in the connected Stripe account. */
export const PLAN_PRICES: Record<string, string> = {
  starter: "price_1UGeAXPCGAMOkfNmsBPEXPnv",
  trade: "price_1UGeBAPCGAMOkfNm9lG1Ux84",
};

const PRICE_TO_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(PLAN_PRICES).map(([slug, price]) => [price, slug]),
);

async function stripeClient() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Billing is not configured yet.");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as never });
}

function siteOrigin() {
  const origin = getRequestHeader("origin");
  if (origin) return origin;
  const host = getRequestHeader("host");
  return host ? `https://${host}` : "https://tradesmanfinder.org";
}

/** Look up (or create) the Stripe customer for this signed-in user. */
async function customerFor(
  stripe: Awaited<ReturnType<typeof stripeClient>>,
  email: string,
  userId: string,
) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0]!.id;
  const created = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });
  return created.id;
}

/** Start a Stripe Checkout session for the chosen membership tier. */
export const createMembershipCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planSlug: string }) => {
    const planSlug = (input?.planSlug ?? "").trim().toLowerCase();
    if (!PLAN_PRICES[planSlug]) throw new Error("Unknown membership tier.");
    return { planSlug };
  })
  .handler(async ({ data, context }) => {
    // Restoring server credentials must not silently activate live payments.
    // Enable only after an explicit operational approval and checkout QA.
    if (process.env["PAYMENTS_ENABLED"] !== "true") {
      throw new Error("Payments are not enabled yet.");
    }
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) throw new Error("We couldn't read your account email.");

    const stripe = await stripeClient();
    const customer = await customerFor(stripe, email, context.userId);
    const origin = siteOrigin();

    const session = await stripe.checkout.sessions.create({
      customer,
      mode: "subscription",
      line_items: [{ price: PLAN_PRICES[data.planSlug]!, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: context.userId, plan_slug: data.planSlug },
      },
      success_url: `${origin}/dashboard?tab=plan&checkout=success`,
      cancel_url: `${origin}/dashboard?tab=plan&checkout=cancelled`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout page.");
    return { url: session.url };
  });

/**
 * Read the caller's live subscription state from Stripe and mirror it onto
 * their `pros` row. Called on the dashboard and after returning from checkout.
 */
export const syncMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) throw new Error("We couldn't read your account email.");

    const stripe = await stripeClient();
    const customers = await stripe.customers.list({ email, limit: 1 });

    let planSlug: string | null = null;
    let status = "none";
    let periodEnd: string | null = null;
    let ref: string | null = null;

    if (customers.data.length > 0) {
      const subs = await stripe.subscriptions.list({
        customer: customers.data[0]!.id,
        status: "all",
        limit: 10,
      });
      const live = subs.data.find((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      );
      if (live) {
        const item = live.items.data[0];
        const priceId = typeof item?.price === "object" ? item.price.id : null;
        planSlug = (priceId && PRICE_TO_PLAN[priceId]) || null;
        status = live.status;
        ref = live.id;
        const end = (item as { current_period_end?: number } | undefined)
          ?.current_period_end;
        periodEnd = end ? new Date(end * 1000).toISOString() : null;
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("pros")
      .update({
        plan_slug: planSlug,
        subscription_status: status,
        subscription_provider: status === "none" ? null : "stripe",
        subscription_ref: ref,
        current_period_end: periodEnd,
      })
      .eq("user_id", context.userId);

    return { planSlug, status, currentPeriodEnd: periodEnd };
  });

/** Stripe customer portal so a firm can change card, upgrade or cancel. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) throw new Error("We couldn't read your account email.");

    const stripe = await stripeClient();
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("You don't have a membership to manage yet.");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0]!.id,
      return_url: `${siteOrigin()}/dashboard?tab=plan`,
    });
    return { url: session.url };
  });
