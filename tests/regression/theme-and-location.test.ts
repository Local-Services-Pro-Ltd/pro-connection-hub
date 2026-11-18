import { describe, expect, it } from "bun:test";
import { formatProLocation } from "@/lib/pro-location";
import { themeBootstrapScript } from "@/hooks/use-theme";

const areas = [
  { slug: "hertfordshire", name: "Hertfordshire" },
  { slug: "buckinghamshire", name: "Buckinghamshire" },
  { slug: "london", name: "Greater London" },
];

describe("firm locations", () => {
  it("joins the town and public area name", () => {
    expect(formatProLocation({ area: "Ware", area_slug: "hertfordshire" }, areas)).toBe(
      "Ware, Hertfordshire",
    );
    expect(formatProLocation({ area: "Amersham", area_slug: "buckinghamshire" }, areas)).toBe(
      "Amersham, Buckinghamshire",
    );
  });

  it("does not repeat matching town and area names", () => {
    expect(formatProLocation({ area: "Greater London", area_slug: "london" }, areas)).toBe(
      "Greater London",
    );
  });

  it("keeps the town when area data is unavailable", () => {
    expect(formatProLocation({ area: "Ware", area_slug: "hertfordshire" }, [])).toBe("Ware");
  });
});

describe("first-visit theme bootstrap", () => {
  function runBootstrap(stored: string | null) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    const window = {
      localStorage: { getItem: () => stored },
      document: { documentElement: root },
    };
    new Function("window", "document", "localStorage", themeBootstrapScript)(
      window,
      window.document,
      window.localStorage,
    );
    return root;
  }

  it("uses Light when no choice has been saved", () => {
    const root = runBootstrap(null);
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });

  it.each(["light", "dim", "dark"])("preserves a saved %s choice", (saved) => {
    const root = runBootstrap(saved);
    expect(root.dataset.theme).toBe(saved);
    expect(root.style.colorScheme).toBe(saved === "light" ? "light" : "dark");
  });
});
