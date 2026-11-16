import { describe, expect, test } from "bun:test";
import {
  firmEntitlements,
  foundingPlanLabel,
  isCheckoutEnabled,
  isFoundingFirm,
  ONBOARDING_FREE,
} from "../../src/lib/onboarding";

const freeFirm = {
  published: true,
  created_at: "2026-11-16T06:03:00.000Z",
  plan_slug: null,
  subscription_status: "none",
};

describe("free onboarding", () => {
  test("the single shared flag keeps checkout unreachable", () => {
    expect(ONBOARDING_FREE).toBe(true);
    expect(isCheckoutEnabled()).toBe(false);
  });

  test("an approved free firm receives every Trade-tier limit", () => {
    expect(firmEntitlements(freeFirm)).toEqual({
      hasAccess: true,
      matchedJobLimit: null,
      tradeCategoryLimit: 3,
      postcodeAreaLimit: 10,
      priorityRanking: true,
      photoPortfolio: true,
    });
  });

  test("an unapproved firm receives no Trade-tier access", () => {
    expect(firmEntitlements({ ...freeFirm, published: false }).hasAccess).toBe(false);
  });

  test("founding status and dashboard label derive from the existing account timestamp", () => {
    expect(isFoundingFirm(freeFirm)).toBe(true);
    expect(foundingPlanLabel(freeFirm)).toBe("Free — founding firm");
    expect(isFoundingFirm({ created_at: "" })).toBe(false);
  });
});
