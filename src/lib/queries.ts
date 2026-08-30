import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Trade = Database["public"]["Tables"]["trades"]["Row"];
export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type Pro = Database["public"]["Tables"]["pros"]["Row"];
export type Credential = Database["public"]["Tables"]["pro_credentials"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type PublicReview = Database["public"]["Views"]["reviews_public"]["Row"];
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
          .from("reviews_public")
          .select("*")
          .eq("pro_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (pro.error) throw pro.error;
      return {
        pro: pro.data as Pro | null,
        credentials: (credentials.data ?? []) as Credential[],
        reviews: (reviews.data ?? []) as PublicReview[],
      };
    },
  });
}

/**
 * Hand-picked firms for the homepage. `featured` is admin-only (enforced by a
 * database trigger) and defaults to false, so the homepage shows this section
 * only once real tradespeople have actually been chosen — never placeholders.
 */
export const featuredProsQuery = queryOptions({
  queryKey: ["featured-pros"],
  queryFn: async (): Promise<Pro[]> => {
    const { data, error } = await supabase
      .from("pros")
      .select("*")
      .eq("published", true)
      .eq("featured", true)
      .order("rating", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(6);
    if (error) throw error;
    return (data ?? []) as Pro[];
  },

  staleTime: 5 * 60_000,
});

export const latestReviewsQuery = queryOptions({
  queryKey: ["latest-reviews"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("reviews_public")
        .select("*")
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
      supabase.from("reviews_public").select("id", { count: "exact", head: true }),
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
        // author_id / author_place are not client-readable — reviewer identity
        // and location stay server-side.
        .select("id, pro_id, author_name, rating, title, body, job_type, status, created_at")
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
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
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

export type ProFeatureAudit =
  Database["public"]["Tables"]["pro_feature_audit"]["Row"];

export type AdminProRow = Pro & {
  verified_credentials: number;
  total_credentials: number;
};

/**
 * Every listing plus its credential-verification counts, so an admin can see
 * at a glance whether a firm is safe to feature. Admin-only via RLS.
 */
export const adminProsQuery = queryOptions({
  queryKey: ["admin", "pros"],
  queryFn: async (): Promise<AdminProRow[]> => {
    const [pros, creds] = await Promise.all([
      supabase.from("pros").select("*").order("company"),
      supabase.from("pro_credentials").select("pro_id, verified"),
    ]);
    if (pros.error) throw pros.error;
    if (creds.error) throw creds.error;
    const tally = new Map<string, { verified: number; total: number }>();
    for (const c of creds.data ?? []) {
      const row = tally.get(c.pro_id) ?? { verified: 0, total: 0 };
      row.total += 1;
      if (c.verified) row.verified += 1;
      tally.set(c.pro_id, row);
    }
    return (pros.data ?? []).map((p) => ({
      ...(p as Pro),
      verified_credentials: tally.get(p.id)?.verified ?? 0,
      total_credentials: tally.get(p.id)?.total ?? 0,
    }));
  },
  staleTime: 0,
});

/** Audit trail of featuring / unfeaturing actions. Admin-only via RLS. */
export const proFeatureAuditQuery = queryOptions({
  queryKey: ["admin", "pro-feature-audit"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("pro_feature_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as ProFeatureAudit[];
  },
  staleTime: 0,
});

/** Full featuring audit trail, used by the admin CSV export. Admin-only via RLS. */
export async function fetchProFeatureAuditAll() {
  const { data, error } = await supabase
    .from("pro_feature_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as ProFeatureAudit[];
}

export type AccessMatrixRow = {
  object_kind: string;
  object_name: string;
  rls_enabled: boolean | null;
  policy_name: string | null;
  command: string | null;
  roles: string | null;
  audience: string | null;
  expression: string | null;
};

/**
 * Admin-only summary of which RLS policies and views govern public vs
 * admin-only access. The RPC itself refuses non-admin callers.
 */
export const accessMatrixQuery = queryOptions({
  queryKey: ["admin", "access-matrix"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("security_access_matrix");
    if (error) throw error;
    return (data ?? []) as AccessMatrixRow[];
  },
  staleTime: 60_000,
});

export type SecurityCheckRow = {
  suite: string;
  check_name: string;
  passed: boolean | null;
  detail: string;
};

/** Admin-only live run of the security regression suites. */
export const securityRegressionQuery = queryOptions({
  queryKey: ["admin", "security-regression"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("security_regression_run");
    if (error) throw error;
    return (data ?? []) as SecurityCheckRow[];
  },
  staleTime: 0,
});

export type ApiAccessEvent = {
  id: string;
  created_at: string;
  endpoint: string;
  bucket: string;
  method: string;
  outcome: string;
  status: number;
  ip_hash: string | null;
  user_agent: string | null;
  detail: string | null;
};

/**
 * Recent denied requests (rate limits, wrong method, bad secret) against the
 * public endpoints. Admin-only through RLS on `api_access_events`.
 */
export const apiAccessEventsQuery = queryOptions({
  queryKey: ["admin", "api-access-events"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("api_access_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as ApiAccessEvent[];
  },
  staleTime: 0,
});

export type TradeHeroImage =
  Database["public"]["Tables"]["trade_hero_images"]["Row"];

/**
 * Per-trade hero overrides set in /admin/hero-images. Publicly readable so a
 * trade page can render an uploaded photo, focal point and alt text without a
 * code change.
 */
export const tradeHeroImagesQuery = queryOptions({
  queryKey: ["trade-hero-images"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("trade_hero_images")
      .select("*")
      .order("slug");
    if (error) throw error;
    return (data ?? []) as TradeHeroImage[];
  },
  staleTime: 60_000,
});

/** Single trade's hero override, or null when the bundled photo is in use. */
export async function fetchTradeHeroImage(slug: string) {
  const { data } = await supabase
    .from("trade_hero_images")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as TradeHeroImage | null) ?? null;
}

export type ProProject = Database["public"]["Tables"]["pro_projects"]["Row"];
export type ProTrust = Database["public"]["Views"]["pro_trust"]["Row"];

/** Published before/after projects for one tradesperson. */
export function proProjectsQuery(proId: string) {
  return queryOptions({
    queryKey: ["pro-projects", proId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pro_projects")
          .select("*")
          .eq("pro_id", proId)
          .eq("published", true)
          .order("sort_order")
          .order("created_at", { ascending: false }),
      ) as ProProject[],
    staleTime: 60_000,
  });
}

/** Recent published projects across every pro in a trade. */
export function tradeProjectsQuery(trade: string) {
  return queryOptions({
    queryKey: ["trade-projects", trade],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pro_projects")
          .select("*")
          .eq("trade_slug", trade)
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(6),
      ) as ProProject[],
    staleTime: 60_000,
  });
}

/** Composite trust scores keyed by pro id. */
export const trustScoresQuery = queryOptions({
  queryKey: ["pro-trust"],
  queryFn: async () => {
    const { data, error } = await supabase.from("pro_trust").select("*");
    if (error) return {} as Record<string, ProTrust>;
    return Object.fromEntries(
      (data ?? []).map((r) => [r.pro_id as string, r as ProTrust]),
    ) as Record<string, ProTrust>;
  },
  staleTime: 60_000,
});

export function proTrustQuery(proId: string) {
  return queryOptions({
    queryKey: ["pro-trust", proId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pro_trust")
        .select("*")
        .eq("pro_id", proId)
        .maybeSingle();
      return (data as ProTrust | null) ?? null;
    },
    staleTime: 60_000,
  });
}

/** Slots already taken for a pro, so the booking grid can grey them out. */
export function bookedSlotsQuery(proId: string) {
  return queryOptions({
    queryKey: ["booked-slots", proId],
    queryFn: async () => {
      const { data } = await supabase.rpc("pro_booked_slots", { p_pro_id: proId });
      return new Set(
        (data ?? []).map((r) => new Date(r.slot_start as string).toISOString()),
      );

    },
    staleTime: 15_000,
  });
}

export type MatchedPro = {
  pro_id: string;
  name: string;
  company: string;
  area: string;
  trade_slug: string;
  rating: number;
  review_count: number;
  response_mins: number;
  years: number;
  availability: Availability;
  photo: number;
  day_rate: number | null;
  trust_score: number;
  match_score: number;
  reason: string;
};

/** Server-side matching: the three best-fitting vetted pros for a job. */
export async function matchPros(args: {
  trade: string;
  postcode?: string | undefined;
  budget?: string | undefined;
  jobId?: string | undefined;
  limit?: number;
}): Promise<MatchedPro[]> {
  const { data, error } = await supabase.rpc("match_pros", {
    p_trade: args.trade,
    p_limit: args.limit ?? 3,
    ...(args.postcode ? { p_postcode: args.postcode } : {}),
    ...(args.budget ? { p_budget: args.budget } : {}),
    ...(args.jobId ? { p_job_id: args.jobId } : {}),
  });
  if (error) throw error;
  return (data ?? []) as MatchedPro[];
}

export type ProAvailability =
  Database["public"]["Tables"]["pro_availability"]["Row"];

/**
 * Visit windows a tradesperson has declared for themselves. Empty means the
 * booking panel falls back to standard weekday windows.
 */
export function proAvailabilityQuery(proId: string) {
  return queryOptions({
    queryKey: ["pro-availability", proId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pro_availability")
          .select("*")
          .eq("pro_id", proId)
          .eq("active", true)
          .order("weekday")
          .order("start_minute"),
      ) as ProAvailability[],
    staleTime: 60_000,
  });
}

/** Every project row for one pro, drafts included. Admin/owner only via RLS. */
export function adminProProjectsQuery(proId: string) {
  return queryOptions({
    queryKey: ["admin", "pro-projects", proId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pro_projects")
          .select("*")
          .eq("pro_id", proId)
          .order("sort_order")
          .order("created_at", { ascending: false }),
      ) as ProProject[],
    staleTime: 0,
  });
}

/** All declared windows for one pro, inactive ones included. */
export function adminProAvailabilityQuery(proId: string) {
  return queryOptions({
    queryKey: ["admin", "pro-availability", proId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pro_availability")
          .select("*")
          .eq("pro_id", proId)
          .order("weekday")
          .order("start_minute"),
      ) as ProAvailability[],
    staleTime: 0,
  });
}

/* ------------------------------------------------------------------ *
 * Waiting-list demand
 * ------------------------------------------------------------------ */

export type WaitingListDemand = {
  postcode_area: string;
  homeowners: number;
  traders: number;
  total: number;
  first_signup: string | null;
};

/**
 * Aggregate demand per postcode area — confirmed sign-ups only and never
 * anything that identifies a person, so it is safe on the public site.
 */
export const waitingListDemandQuery = queryOptions({
  queryKey: ["waiting-list", "demand"],
  queryFn: async () =>
    unwrap(await supabase.rpc("waiting_list_demand")) as WaitingListDemand[],
  staleTime: 60_000,
});

export type WaitingListAdminSummary = {
  postcode_area: string;
  total: number;
  confirmed: number;
  homeowners: number;
  traders: number;
  trades: string | null;
  last_signup: string | null;
};

/** Admin-only breakdown: unconfirmed sign-ups and trade demand included. */
export const waitingListAdminSummaryQuery = queryOptions({
  queryKey: ["admin", "waiting-list", "summary"],
  queryFn: async () =>
    unwrap(
      await supabase.rpc("waiting_list_admin_summary"),
    ) as WaitingListAdminSummary[],
  staleTime: 0,
});

export type WaitingListRow =
  Database["public"]["Tables"]["waiting_list"]["Row"];

/** Recent sign-ups. Readable by admins only (RLS). */
export const waitingListRecentQuery = queryOptions({
  queryKey: ["admin", "waiting-list", "recent"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("waiting_list")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ) as WaitingListRow[],
  staleTime: 0,
});

export type WaitingListTrendPoint = {
  postcode_area: string;
  week: string;
  signups: number;
  cumulative: number;
};

/**
 * Weekly confirmed sign-ups per postcode area. Aggregate only, safe to show
 * publicly alongside the current totals on /coverage.
 */
export function waitingListTrendQuery(weeks = 8) {
  return queryOptions({
    queryKey: ["waiting-list", "trend", weeks],
    queryFn: async () =>
      unwrap(
        await supabase.rpc("waiting_list_trend", { p_weeks: weeks }),
      ) as WaitingListTrendPoint[],
    staleTime: 60_000,
  });
}

/* ---------- Ask the Pros (moderated public Q&A) ---------- */

export type PublicQuestion = {
  id: string;
  title: string;
  body: string;
  trade_slug: string | null;
  asker_name: string;
  area: string | null;
  published_at: string | null;
  answer_count: number;
};

export const questionsQuery = (trade?: string) =>
  queryOptions({
    queryKey: ["questions", trade ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_questions", {
        ...(trade ? { p_trade: trade } : {}),
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as unknown as PublicQuestion[];
    },
    staleTime: 60_000,
  });

export const questionQuery = (id: string) =>
  queryOptions({
    queryKey: ["question", id],
    queryFn: async () => {
      const [{ data: question }, { data: answers }] = await Promise.all([
        supabase.from("questions").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("answers")
          .select("*")
          .eq("question_id", id)
          .order("created_at"),
      ]);
      return {
        question: question as Database["public"]["Tables"]["questions"]["Row"] | null,
        answers: (answers ?? []) as Database["public"]["Tables"]["answers"]["Row"][],
      };
    },
    staleTime: 60_000,
  });

export type RelatedQuestion = {
  id: string;
  title: string;
  trade_slug: string | null;
  answer_count: number;
};

/** Already-answered questions similar to what a homeowner is typing. */
export const relatedQuestionsQuery = (query: string) =>
  queryOptions({
    queryKey: ["related-questions", query],
    queryFn: async () => {
      const trimmed = query.trim();
      if (trimmed.length < 8) return [] as RelatedQuestion[];
      const { data, error } = await supabase.rpc("search_questions", {
        p_query: trimmed,
        p_limit: 4,
      });
      if (error) throw error;
      return (data ?? []) as unknown as RelatedQuestion[];
    },
    staleTime: 60_000,
  });
