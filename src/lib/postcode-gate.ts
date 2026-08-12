// TradesmanFinder — postcode gate
//
// Checks whether a UK postcode falls inside a currently-live service area
// (Greater London, Kent, Surrey). Used by /post-job before creating a job and
// by the waiting-list handoff. Errs on the side of accepting borderline cases.

export type LiveArea = "london" | "kent" | "surrey";

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
};

const LIVE_PREFIXES = new Set(Object.values(AREA_POSTCODE_PREFIXES).flat());

export const LIVE_AREA_NAMES: Record<LiveArea, string> = {
  london: "Greater London",
  kent: "Kent",
  surrey: "Surrey",
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
export function isLiveArea(postcode: string): boolean {
  const prefix = outwardPrefix(postcode);
  return prefix ? LIVE_PREFIXES.has(prefix) : false;
}

/** First matching live area (London wins overlaps), or null. */
export function liveAreaFor(postcode: string): LiveArea | null {
  const prefix = outwardPrefix(postcode);
  if (!prefix) return null;
  for (const area of ["london", "kent", "surrey"] as LiveArea[]) {
    if (AREA_POSTCODE_PREFIXES[area].includes(prefix)) return area;
  }
  return null;
}

/** Every live area that covers this postcode (overlaps included). */
export function liveAreasFor(postcode: string): LiveArea[] {
  const prefix = outwardPrefix(postcode);
  if (!prefix) return [];
  return (["london", "kent", "surrey"] as LiveArea[]).filter((a) =>
    AREA_POSTCODE_PREFIXES[a].includes(prefix),
  );
}
