import { describe, expect, it } from "vitest";
import { areaCostRegion, regionalJobRange } from "@/lib/area-pages";
import { firmJobView, postcodeDistrict } from "@/lib/job-interest.shared";

describe("area cost-guide regions", () => {
  it("maps every live area to the requested regional factor", () => {
    expect(areaCostRegion("london")).toBe("london");
    for (const area of ["kent", "surrey", "berkshire", "buckinghamshire", "hertfordshire"]) {
      expect(areaCostRegion(area)).toBe("south-east");
    }
    expect(areaCostRegion("birmingham")).toBe("midlands");
    expect(areaCostRegion("bristol")).toBe("midlands");
    expect(areaCostRegion("manchester")).toBe("north");
    expect(areaCostRegion("leeds")).toBe("north");
    expect(regionalJobRange("london", 100, 200)).toEqual([118, 236]);
    expect(regionalJobRange("manchester", 100, 200)).toEqual([88, 176]);
  });
});

describe("firm job privacy shape", () => {
  it("returns only safe job fields and an outward postcode district", () => {
    const job = firmJobView(
      {
        id: "job-1",
        reference: "JOB-1",
        title: "Repair a leak",
        description: "A leaking kitchen tap needs repair.",
        timing: "Within 2 weeks",
        budget_band: "under-500",
        created_at: "2026-11-18T00:00:00Z",
        postcode: "hp6  5ab",
        contact_name: "Private Homeowner",
        contact_email: "private@example.com",
        user_id: "private-user",
      },
      true,
    );
    expect(job).toEqual({
      id: "job-1",
      reference: "JOB-1",
      title: "Repair a leak",
      description: "A leaking kitchen tap needs repair.",
      timing: "Within 2 weeks",
      budget_band: "under-500",
      created_at: "2026-11-18T00:00:00Z",
      postcode_district: "HP6",
      interested: true,
    });
    expect(job).not.toHaveProperty("contact_name");
    expect(job).not.toHaveProperty("contact_email");
    expect(job).not.toHaveProperty("user_id");
    expect(job).not.toHaveProperty("postcode");
    expect(postcodeDistrict("SE1 7PB")).toBe("SE1");
  });
});
