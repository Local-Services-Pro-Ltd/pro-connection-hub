export type SharedPosition = {
  lat: number;
  lon: number;
  exp: number;
};

/** URL-safe base64 of a tiny JSON payload — no server, nothing stored. */
export function encodeShare(p: SharedPosition): string {
  const json = JSON.stringify([
    Math.round(p.lat * 1e5) / 1e5,
    Math.round(p.lon * 1e5) / 1e5,
    p.exp,
  ]);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(token: string): SharedPosition | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(b64)) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 3) return null;
    const [lat, lon, exp] = parsed as number[];
    if (![lat, lon, exp].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    if (exp <= Date.now()) return null;
    return { lat, lon, exp };
  } catch {
    return null;
  }
}

export const SHARE_DURATIONS = [
  { label: "15 minutes", ms: 15 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "8 hours", ms: 8 * 60 * 60_000 },
] as const;
