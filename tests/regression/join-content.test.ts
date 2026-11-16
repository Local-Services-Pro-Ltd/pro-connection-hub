import { describe, expect, test } from "bun:test";
import { joinFactTiles } from "../../src/lib/join-content";

describe("/join fact tiles", () => {
  test("free onboarding shows the four owner-approved tiles", () => {
    expect(joinFactTiles(true)).toEqual([
      { value: "Free", label: "while we onboard trades" },
      { value: "50% off", label: "your first 12 months once charging starts" },
      { value: "£0", label: "per lead or job won" },
      { value: "30 days", label: "notice before anything is charged" },
    ]);
  });
  test("free and founding tiles disappear when charging is on", () => {
    const values = joinFactTiles(false).map((t) => t.value);
    expect(values).not.toContain("Free");
    expect(values).not.toContain("50% off");
  });
});
