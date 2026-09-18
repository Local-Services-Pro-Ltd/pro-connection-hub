// TradesmanFinder — postcode gate
//
// Checks whether a UK postcode falls inside a currently-live service area
// supplied by the areas table. Used by /post-job before creating a job and
// by the waiting-list handoff. Errs on the side of accepting borderline cases.

export type LiveArea = "london" | "kent" | "surrey" | "berkshire" |
  "manchester" | "birmingham" | "bristol" | "leeds";

export type CoverageArea = { slug: string; status: string };

const AREA_POSTCODE_PREFIXES: Record<LiveArea, string[]> = {
  london: [
    "EC",
    "WC",
    "E",
    "N",
    "NW",
    "SE",
    "SW",
    "W",
    "BR",
    "CR",
    "DA",
    "EN",
    "HA",
    "IG",
    "KT",
    "RM",
    "SM",
    "TW",
    "UB",
    "WD",
  ],
  kent: ["BR", "CT", "DA", "ME", "TN"],
  surrey: ["CR", "GU", "KT", "RH", "SM", "TW"],
  berkshire: ["RG", "SL"],
  manchester: ["M"],
  birmingham: ["B"],
  bristol: ["BS"],
  leeds: ["LS"],
};

export const LIVE_AREA_NAMES: Record<LiveArea, string> = {
  london: "Greater London",
  kent: "Kent",
  surrey: "Surrey",
  berkshire: "Berkshire",
  manchester: "Manchester",
  birmingham: "Birmingham",
  bristol: "Bristol",
  leeds: "Leeds",
};

/** "se1 7pb" -> "SE". Empty string when unparseable. */
export function outwardPrefix(postcode: string): string {
  if (!postcode) return "";
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2})[0-9]/);
  return match?.[1] ?? "";
}

/** "SE1 7PB" -> "SE1". */
export function outwardCode(postcode: string): string {
  if (!postcode) return "";
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2}[0-9][A-Z0-9]?)/);
  return match?.[1] ?? "";
}

/** True when the postcode sits inside any live area. */
export function isLiveArea(postcode: string, areas: readonly CoverageArea[]): boolean {
  return liveAreasFor(postcode, areas).length > 0;
}

/** First matching live area (London wins overlaps), or null. */
export function liveAreaFor(postcode: string, areas: readonly CoverageArea[]): LiveArea | null {
  return liveAreasFor(postcode, areas)[0] ?? null;
}

/** Every live area that covers this postcode (overlaps included). */
export function liveAreasFor(postcode: string, areas: readonly CoverageArea[]): LiveArea[] {
  const prefix = outwardPrefix(postcode);
  if (!prefix) return [];
  const live = new Set(areas.filter(a => a.status === "live").map(a => a.slug));
  return (Object.keys(AREA_POSTCODE_PREFIXES) as LiveArea[]).filter((a) =>
    live.has(a) && AREA_POSTCODE_PREFIXES[a].includes(prefix),
  );
}
