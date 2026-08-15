import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Trade = Database["public"]["Tables"]["trades"]["Row"];
export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type Pro = Database["public"]["Tables"]["pros"]["Row"];
export type Credential = Database["public"]["Tables"]["pro_credentials"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Availability = Database["public"]["Enums"]["availability"];

export const availabilityLabels: Record<Availability, string> = {
  immediate: "Available now",
  within_week: "Within a week",
  within_month: "Within a month",
  booked: "Booked up",
};

export const budgetBands = [
  { value: "any", label: "Any budget", min: 0 },
  { value: "under-500", label: "Under £500", min: 0, max: 500 },
  { value: "500-2000", label: "£500 – £2,000", min: 500, max: 2000 },
  { value: "2000-10000", label: "£2,000 – £10,000", min: 2000, max: 10000 },
  { value: "10000-plus", label: "£10,000+", min: 10000 },
] as const;

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error instanceof Error ? error : new Error(String(error));
  return (data ?? []) as T;
}

export const tradesQuery = queryOptions({
  queryKey: ["trades"],
  queryFn: async () =>
    unwrap(await supabase.from("trades").select("*").order("sort_order")),
  staleTime: 5 * 60_000,
});

export const areasQuery = queryOptions({
  queryKey: ["areas"],
  queryFn: async () =>
    unwrap(await supabase.from("areas").select("*").order("sort_order")),
  staleTime: 5 * 60_000,
});

export type Plan = Database["public"]["Tables"]["plans"]["Row"];

/**
 * Membership tiers shown on /for-tradesmen. Every tier is returned here —
 * public display is decided by `planVisibilityQuery` below, so a hidden tier
 * (currently Contractor) stays fully functional for direct signup links.
 */
export const plansQuery = queryOptions({
  queryKey: ["plans"],
  queryFn: async () =>
    unwrap(await supabase.from("plans").select("*").order("sort_order")),
  staleTime: 5 * 60_000,
});

/**
 * Runtime display toggle for pricing tiers. Admins flip `is_public` in the
 * backend and the pricing page follows on the next load — no deploy needed.
 * Display-only: billing, entitlements and /signin?plan=<slug> are unaffected.
 */
export const planVisibilityQuery = queryOptions({
  queryKey: ["plan-visibility"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("plan_visibility")
      .select("plan_slug, is_public, display_order");
    // Never break the pricing page on a backend hiccup — the caller falls
    // back to hard-coded defaults when this map is empty.
    if (error || !data) return {} as Record<string, boolean>;
    return Object.fromEntries(
      data.map((r) => [r.plan_slug, r.is_public]),
    ) as Record<string, boolean>;
  },
  staleTime: 60_000,
});


/** Live counts of published pros per trade slug and per area slug. */
export const proCountsQuery = queryOptions({
  queryKey: ["pro-counts"],
  queryFn: async () => {
    const rows = unwrap(
      await supabase
        .from("pros")
        .select("trade_slug, area_slug")
        .eq("published", true),
    ) as { trade_slug: string; area_slug: string | null }[];
    const byTrade: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    for (const r of rows) {
      byTrade[r.trade_slug] = (byTrade[r.trade_slug] ?? 0) + 1;
      if (r.area_slug) byArea[r.area_slug] = (byArea[r.area_slug] ?? 0) + 1;
    }
    return { byTrade, byArea, total: rows.length };
  },
  staleTime: 5 * 60_000,
});

export type ProFilters = {
  trade?: string | undefined;
  area?: string | undefined;
  budget?: string | undefined;
  availability?: string | undefined;
  q?: string | undefined;
  sort?: string | undefined;
};

export function prosQuery(filters: ProFilters = {}) {
  return queryOptions({
    queryKey: ["pros", filters],
    queryFn: async () => {
      let query = supabase.from("pros").select("*").eq("published", true);

      if (filters.trade) query = query.eq("trade_slug", filters.trade);
      if (filters.area) {
        query = query.or(
          `area_slug.eq.${filters.area},area.ilike.%${filters.area}%,postcode.ilike.${filters.area}%`,
        );
      }
      if (filters.availability && filters.availability !== "any") {
        query = query.eq("availability", filters.availability as Availability);
      }
      const band = budgetBands.find((b) => b.value === filters.budget);
      if (band && band.value !== "any" && "max" in band && band.max) {
        query = query.lte("min_job_budget", band.max);
      }
      if (filters.q) {
        query = query.or(
          `company.ilike.%${filters.q}%,name.ilike.%${filters.q}%,bio.ilike.%${filters.q}%`,
        );
      }

      switch (filters.sort) {
        case "response":
          query = query.order("response_mins", { ascending: true });
          break;
        case "reviews":
          query = query.order("review_count", { ascending: false });
          break;
        case "experience":
          query = query.order("years", { ascending: false });
          break;
        default:
          query = query
            .order("rating", { ascending: false })
            .order("review_count", { ascending: false });
      }

      return unwrap(await query);
    },
  });
}

export function proQuery(id: string) {
  return queryOptions({
    queryKey: ["pro", id],
    queryFn: async () => {
      const [pro, credentials, reviews] = await Promise.all([
        supabase.from("pros").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("pro_credentials")
          .select("*")
          .eq("pro_id", id)
          .order("created_at"),
        supabase
          .from("reviews")
          .select("*")
          .eq("pro_id", id)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
      ]);
      if (pro.error) throw pro.error;
      return {
        pro: pro.data as Pro | null,
        credentials: (credentials.data ?? []) as Credential[],
        reviews: (reviews.data ?? []) as Review[],
      };
    },
  });
}

export const latestReviewsQuery = queryOptions({
  queryKey: ["latest-reviews"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("reviews")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(6),
    ),
  staleTime: 60_000,
});

export const statsQuery = queryOptions({
  queryKey: ["stats"],
  queryFn: async () => {
    const [pros, reviews, jobs] = await Promise.all([
      supabase
        .from("pros")
        .select("response_mins", { count: "exact" })
        .eq("published", true),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("trades").select("slug", { count: "exact", head: true }),
    ]);
    const mins = (pros.data ?? []).map((p) => p.response_mins);
    const avg = mins.length
      ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
      : 0;
    return {
      pros: pros.count ?? 0,
      reviews: reviews.count ?? 0,
      trades: jobs.count ?? 0,
      avgResponse: avg,
    };
  },
  staleTime: 5 * 60_000,
});

export const myJobsQuery = queryOptions({
  queryKey: ["my-jobs"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
});

export const myReviewsQuery = queryOptions({
  queryKey: ["my-reviews"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
});

export type PlanVisibility =
  Database["public"]["Tables"]["plan_visibility"]["Row"];

/** Everything the admin plan-visibility screen needs, hidden tiers included. */
export const adminPlansQuery = queryOptions({
  queryKey: ["admin", "plans"],
  queryFn: async () => {
    const [plans, visibility] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("plan_visibility").select("*").order("display_order"),
    ]);
    if (plans.error) throw plans.error;
    if (visibility.error) throw visibility.error;
    return {
      plans: (plans.data ?? []) as Plan[],
      visibility: (visibility.data ?? []) as PlanVisibility[],
    };
  },
  staleTime: 0,
});

/** True when the signed-in account holds the admin role. */
export function isAdminQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["is-admin", userId ?? null],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      return error ? false : Boolean(data);
    },
    staleTime: 60_000,
  });
}

export type PlanVisibilityAudit =
  Database["public"]["Tables"]["plan_visibility_audit"]["Row"];

/** Append-only trail of every show/hide change, newest first. Admins only. */
export const planVisibilityAuditQuery = queryOptions({
  queryKey: ["admin", "plan-visibility-audit"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("plan_visibility_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as PlanVisibilityAudit[];
  },
  staleTime: 0,
});

export type FormBlockDay = {
  day: string;
  form: string;
  reason: string;
  hits: number;
};

/**
 * Daily counts of waiting-list / post-job submissions stopped by the spam
 * gate (rate limit, human check, honeypot). Admins only — the underlying log
 * is readable by admins alone.
 */
export function formBlockDailyQuery(days: number) {
  return queryOptions({
    queryKey: ["admin", "form-blocks", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("form_block_daily", {
        p_days: days,
      });
      if (error) throw error;
      return (data ?? []) as FormBlockDay[];
    },
    staleTime: 30_000,
  });
}

/** Audit rows inside a date range, used by the CSV export. */
export async function fetchAuditRange(fromISO: string, toISO: string) {
  const { data, error } = await supabase
    .from("plan_visibility_audit")
    .select("*")
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlanVisibilityAudit[];
}
