import { describe, expect, it } from "vitest";
import { isPortfolioPath, publicPortfolioItem } from "@/lib/portfolio.shared";
import type { PortfolioProjectRow } from "@/lib/portfolio.types";

const row: PortfolioProjectRow = {
  id: "project-1",
  pro_id: "keystone-london",
  trade_slug: "plumber",
  title: "Bathroom refit",
  summary: "A completed bathroom refit.",
  before_url: "keystone-london/before.webp",
  after_url: "keystone-london/after.webp",
  extra_photos: ["keystone-london/detail.webp"],
  completed_on: "2026-10-01",
  sort_order: 0,
  published: true,
  status: "approved",
  reviewer_note: null,
  reviewed_at: null,
  reviewed_by: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const signed = {
  "keystone-london/before.webp": "https://signed.example/before",
  "keystone-london/after.webp": "https://signed.example/after",
  "keystone-london/detail.webp": "https://signed.example/detail",
};

describe("public portfolio approval guard", () => {
  it("returns signed photos only for approved, published rows", () => {
    expect(publicPortfolioItem(row, signed)).toEqual({
      id: "project-1",
      title: "Bathroom refit",
      summary: "A completed bathroom refit.",
      trade_slug: "plumber",
      completed_on: "2026-10-01",
      before: "https://signed.example/before",
      after: "https://signed.example/after",
      extras: ["https://signed.example/detail"],
    });
    for (const status of ["pending", "rejected"] as const) {
      expect(publicPortfolioItem({ ...row, status }, signed)).toBeNull();
    }
    expect(publicPortfolioItem({ ...row, published: false }, signed)).toBeNull();
  });
});

describe("portfolio object path validation", () => {
  it("accepts only image objects inside the owning firm's folder", () => {
    expect(isPortfolioPath("keystone-london", "keystone-london/abc123-after.webp")).toBe(true);
    expect(isPortfolioPath("keystone-london", "another-firm/after.webp")).toBe(false);
    expect(isPortfolioPath("keystone-london", "keystone-london/../private.webp")).toBe(false);
    expect(
      isPortfolioPath("keystone-london", "https://example.com/keystone-london/after.webp"),
    ).toBe(false);
    expect(isPortfolioPath("keystone-london", "keystone-london/after.webp?token=secret")).toBe(
      false,
    );
    expect(isPortfolioPath("keystone-london", "keystone-london/notes.txt")).toBe(false);
  });
});
