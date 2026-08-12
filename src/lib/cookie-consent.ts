export type CookiePrefs = {
  necessary: true;
  analytics: boolean;
  personalisation: boolean;
  decidedAt: number;
};

const KEY = "tf.cookie-prefs";
export const OPEN_EVENT = "tf:open-cookie-prefs";
export const CHANGE_EVENT = "tf:cookie-prefs-changed";

export function readCookiePrefs(): CookiePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookiePrefs>;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      personalisation: Boolean(parsed.personalisation),
      decidedAt: Number(parsed.decidedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeCookiePrefs(next: Omit<CookiePrefs, "necessary" | "decidedAt">) {
  const value: CookiePrefs = { necessary: true, ...next, decidedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage blocked — choice applies to this session only */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
  return value;
}

/** Re-open the cookie preference panel from anywhere (e.g. the footer link). */
export function openCookiePreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }
}
