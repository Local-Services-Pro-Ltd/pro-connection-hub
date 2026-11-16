/**
 * Owner-controlled commercial switch. While true, approved firms receive the
 * Trade tier without a card and every billing entry point stays unreachable.
 * The server passes this value into database enforcement; never accept it
 * from browser input.
 */
export const ONBOARDING_FREE = true;

export const TRADE_TIER_LIMITS = {
  matchedJobLimit: null, // null means unlimited
  tradeCategoryLimit: 3,
  postcodeAreaLimit: 10,
  priorityRanking: true,
  photoPortfolio: true,
} as const;

export type FirmPlanState = {
  published: boolean;
  created_at: string;
  plan_slug: string | null;
  subscription_status: string;
};

export function isFoundingFirm(pro: Pick<FirmPlanState, "created_at">) {
  // Existing timestamps identify accounts joining during this free period;
  // no new profile or listing column is required.
  return ONBOARDING_FREE && Boolean(pro.created_at);
}

export function isCheckoutEnabled() {
  // This is the sole commercial switch: turning onboarding off is the one
  // change required to make the dormant billing flow reachable again.
  return !ONBOARDING_FREE;
}

export function foundingPlanLabel(pro: Pick<FirmPlanState, "created_at">) {
  return isFoundingFirm(pro) ? "Free — founding firm" : "Free while we onboard";
}

export function firmEntitlements(pro: FirmPlanState) {
  if (!pro.published) {
    return {
      hasAccess: false,
      matchedJobLimit: 0,
      tradeCategoryLimit: 0,
      postcodeAreaLimit: 0,
      priorityRanking: false,
      photoPortfolio: false,
    };
  }

  const paid = ["active", "trialing", "past_due"].includes(pro.subscription_status);

  if (ONBOARDING_FREE || (paid && pro.plan_slug === "trade")) {
    return { hasAccess: true, ...TRADE_TIER_LIMITS };
  }

  if (paid && pro.plan_slug === "starter") {
    return {
      hasAccess: true,
      matchedJobLimit: 8,
      tradeCategoryLimit: 1,
      postcodeAreaLimit: 3,
      priorityRanking: false,
      photoPortfolio: false,
    };
  }

  if (paid && pro.plan_slug === "contractor") {
    return {
      hasAccess: true,
      matchedJobLimit: null,
      tradeCategoryLimit: null,
      postcodeAreaLimit: null,
      priorityRanking: true,
      photoPortfolio: true,
    };
  }

  return {
    hasAccess: false,
    matchedJobLimit: 0,
    tradeCategoryLimit: 0,
    postcodeAreaLimit: 0,
    priorityRanking: false,
    photoPortfolio: false,
  };
}
