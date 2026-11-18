import { describe, expect, test } from "bun:test";
import {
  credentialRegisterUrl,
  credentialState,
  credentialVerificationUpdate,
} from "../../src/lib/registers";
import { maintainProCredentials } from "../../src/lib/application-checks.server";
import { currentCredentialTrust } from "../../src/lib/queries";

describe("official register credentials", () => {
  test("expiry wins over a stale verified flag", () => {
    expect(credentialState({ verified: true, expires_on: "2026-11-17" }, "2026-11-18")).toBe(
      "expired",
    );
    expect(credentialState({ verified: true, expires_on: "2026-11-18" }, "2026-11-18")).toBe(
      "verified",
    );
    expect(credentialState({ verified: false, expires_on: null }, "2026-11-18")).toBe("pending");
  });

  test("Companies House links contain the supplied reference", () => {
    expect(credentialRegisterUrl("companies_house", "AB 123456")).toBe(
      "https://find-and-update.company-information.service.gov.uk/company/AB%20123456",
    );
    expect(credentialRegisterUrl("companies_house", null)).toBeNull();
    expect(credentialRegisterUrl("insurance", "POLICY-1")).toBeNull();
  });

  test("verifying stamps now while unverifying preserves the existing timestamp", () => {
    expect(credentialVerificationUpdate(true, new Date("2026-11-18T02:56:00Z"))).toEqual({
      verified: true,
      verified_at: "2026-11-18T02:56:00.000Z",
    });
    expect(credentialVerificationUpdate(false)).toEqual({ verified: false });
  });

  test("expired credentials lose their trust points", () => {
    const trust = currentCredentialTrust(
      {
        pro_id: "firm-1",
        trade_slug: "roofer",
        verified_credentials: 2,
        total_credentials: 2,
        score: 70,
      },
      [
        { pro_id: "firm-1", verified: true, expires_on: "2026-11-17" },
        { pro_id: "firm-1", verified: true, expires_on: "2027-11-18" },
      ],
      new Date("2026-11-18T00:00:00Z"),
    );
    expect(trust.verified_credentials).toBe(1);
    expect(trust.score).toBe(60);
  });
});

type SelectResult = { data: unknown[]; error: null };

function fakeMaintenanceClient(selectResults: SelectResult[]) {
  const updates: Record<string, unknown>[] = [];
  let selectCalls = 0;
  const client = {
    from: () => ({
      select: () => {
        const result = selectResults[selectCalls++] ?? { data: [], error: null };
        let maximum = result.data.length;
        const builder = {
          eq: () => builder,
          not: () => builder,
          lt: () => builder,
          order: () => builder,
          limit: (value: number) => {
            maximum = value;
            return builder;
          },
          then: (resolve: (value: SelectResult) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve({ data: result.data.slice(0, maximum), error: null }).then(
              resolve,
              reject,
            ),
        };
        return builder;
      },
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        const builder = {
          eq: () => builder,
          then: (resolve: (value: { error: null }) => unknown) =>
            Promise.resolve({ error: null }).then(resolve),
        };
        return builder;
      },
    }),
  };
  return { client, updates, selectCalls: () => selectCalls };
}

describe("nightly credential maintenance", () => {
  test("unverifies expired and inactive-company credentials", async () => {
    const fake = fakeMaintenanceClient([
      { data: [{ id: "expired", pro_id: "p1", expires_on: "2026-01-01" }], error: null },
      {
        data: [
          { id: "inactive", pro_id: "p2", reference: "12345678", pros: { company: "Old Ltd" } },
        ],
        error: null,
      },
    ]);
    const counts = await maintainProCredentials(
      fake.client as never,
      new Date("2026-02-01T00:00:00Z"),
      async () => ({
        key: "companies_house",
        label: "Companies House",
        outcome: "fail",
        detail: "Old Ltd is dissolved on the register.",
      }),
    );
    expect(counts).toEqual({
      processed: 2,
      expired_unverified: 1,
      companies_house_checked: 1,
      companies_house_unverified: 1,
      warnings: 0,
      failures: 0,
    });
    expect(fake.updates).toEqual([{ verified: false }, { verified: false }]);
  });

  test("leaves a credential unchanged when the lookup warns", async () => {
    const fake = fakeMaintenanceClient([
      { data: [], error: null },
      {
        data: [
          { id: "warning", pro_id: "p1", reference: "12345678", pros: { company: "Warn Ltd" } },
        ],
        error: null,
      },
    ]);
    const counts = await maintainProCredentials(
      fake.client as never,
      new Date("2026-02-01T00:00:00Z"),
      async () => ({
        key: "companies_house",
        label: "Companies House",
        outcome: "warn",
        detail: "Register lookup couldn't be reached.",
      }),
    );
    expect(counts.companies_house_checked).toBe(1);
    expect(counts.warnings).toBe(1);
    expect(counts.companies_house_unverified).toBe(0);
    expect(fake.updates).toEqual([]);
  });

  test("processes no more than 200 selected rows in one run", async () => {
    const expired = Array.from({ length: 200 }, (_, index) => ({
      id: `expired-${index}`,
      pro_id: "p1",
      expires_on: "2026-01-01",
    }));
    const fake = fakeMaintenanceClient([{ data: expired, error: null }]);
    const counts = await maintainProCredentials(
      fake.client as never,
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(counts.processed).toBe(200);
    expect(counts.expired_unverified).toBe(200);
    expect(fake.updates).toHaveLength(200);
    expect(fake.selectCalls()).toBe(1);
  });
});
