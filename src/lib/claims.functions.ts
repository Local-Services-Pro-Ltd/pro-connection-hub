import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClaimableListing = {
  id: string;
  company: string;
  trade: string;
  area: string;
};

const CLAIM_ROLES = ["Owner", "Director", "Partner", "Employee"] as const;

async function limitByIp(scope: string, limit: number, windowSeconds: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
  const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const { data: allowed, error } = await supabaseAdmin.rpc("hit_rate_limit", {
    p_bucket: `${scope}:${ipKey}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[claims] rate limit failed", error);
    throw new Error("Search is temporarily unavailable. Please try again.");
  }
  if (allowed === false) {
    throw new Error("That's a lot of searches in a short space of time. Please try again shortly.");
  }
}

function asPublicListing(row: {
  id: string;
  company: string;
  trade_slug: string | null;
  area: string;
}): ClaimableListing {
  return {
    id: row.id,
    company: row.company,
    trade: row.trade_slug ?? "Trade not given",
    area: row.area,
  };
}

/** Public, rate-limited search. Never select contact or ownership fields. */
export const searchClaimableListings = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    const query = (input.query ?? "").trim().replace(/\s+/g, " ");
    if (query.length < 3) throw new Error("Enter at least 3 characters to search.");
    return { query: query.slice(0, 80) };
  })
  .handler(async ({ data }): Promise<ClaimableListing[]> => {
    await limitByIp("claim-search", 30, 600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove PostgREST pattern and OR-syntax characters from visitor input.
    const term = data.query.replace(/[%_(),.*\\]/g, " ").trim();
    if (term.length < 3) return [];
    const pattern = `%${term}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("pros")
      .select("id, company, trade_slug, area")
      .eq("published", true)
      .is("user_id", null)
      .or(`company.ilike.${pattern},postcode.ilike.${pattern}`)
      .order("company", { ascending: true })
      .limit(10);
    if (error) {
      console.error("[claims] public search failed", error);
      throw new Error("Search is temporarily unavailable. Please try again.");
    }
    return (rows ?? []).map(asPublicListing);
  });

/** Public listing summary for the claim page, with the same eligibility rule. */
export const getClaimableListing = createServerFn({ method: "POST" })
  .inputValidator((input: { proId: string }) => {
    const proId = (input.proId ?? "").trim();
    if (!proId || proId.length > 120) throw new Error("We couldn't find that listing.");
    return { proId };
  })
  .handler(async ({ data }): Promise<ClaimableListing> => {
    await limitByIp("claim-listing", 60, 600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("pros")
      .select("id, company, trade_slug, area")
      .eq("id", data.proId)
      .eq("published", true)
      .is("user_id", null)
      .maybeSingle();
    if (error) {
      console.error("[claims] listing lookup failed", error);
      throw new Error("We couldn't load that listing. Please try again.");
    }
    if (!row) throw new Error("This listing is not available to claim.");
    return asPublicListing(row);
  });

export type ListingClaimInput = {
  proId: string;
  fullName: string;
  role: string;
  workEmail: string;
  phone: string;
  consent: boolean;
};

/** Creates a pending claim only. Admin approval is required to link the account. */
export const submitListingClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ListingClaimInput) => {
    const fullName = (input.fullName ?? "").trim();
    const role = (input.role ?? "").trim();
    const workEmail = (input.workEmail ?? "").trim().toLowerCase();
    const phone = (input.phone ?? "").trim();
    if (!input.proId) throw new Error("We couldn't find that listing.");
    if (fullName.length < 2) throw new Error("Please enter your full name.");
    if (!CLAIM_ROLES.includes(role as (typeof CLAIM_ROLES)[number]))
      throw new Error("Please choose your role at the business.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(workEmail))
      throw new Error("Please enter a valid work email address.");
    if (phone.length < 7) throw new Error("Please enter your phone number.");
    if (input.consent !== true)
      throw new Error("Please confirm you're authorised to manage this listing.");
    return {
      proId: input.proId,
      fullName: fullName.slice(0, 120),
      role,
      workEmail: workEmail.slice(0, 254),
      phone: phone.slice(0, 40),
      consent: true,
    };
  })
  .handler(async ({ data, context }) => {
    await limitByIp("claim-submit", 8, 3600);
    const { data: id, error } = await context.supabase.rpc("submit_listing_claim", {
      p_pro_id: data.proId,
      p_contact_name: data.fullName,
      p_role: data.role,
      p_email: data.workEmail,
      p_phone: data.phone,
      p_consent: data.consent,
    });
    if (error) {
      if (error.code === "23505")
        throw new Error("You already have an open claim for this listing.");
      if (error.message.includes("listing_unavailable"))
        throw new Error("This listing is no longer available to claim.");
      if (error.message.includes("listing_already_claimed"))
        throw new Error("This listing has already been claimed.");
      console.error("[claims] submission failed", error);
      throw new Error("We couldn't send your claim. Please try again.");
    }
    return { id: String(id), status: "pending" as const };
  });
