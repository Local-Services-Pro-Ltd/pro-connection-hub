import { useCallback, useEffect, useRef, useState } from "react";

export type GpsConsent = "unknown" | "granted" | "denied";

const KEY = "tf.gps-consent";

export type GpsFix = {
  lat: number;
  lon: number;
  accuracy: number;
  at: number;
};

/**
 * Consent-gated browser geolocation.
 * Consent is remembered in localStorage; nothing is read from the device
 * until the visitor explicitly opts in, and opting out stops the watcher.
 */
export const TRACK_WINDOW_MS = 30 * 60_000;

export function useGpsConsent() {
  const [consent, setConsent] = useState<GpsConsent>("unknown");
  const [fix, setFix] = useState<GpsFix | null>(null);
  /** Accuracy-weighted smoothed position — steadier marker movement. */
  const [smoothed, setSmoothed] = useState<GpsFix | null>(null);
  /** Rolling buffer of fixes from the last 30 minutes (in-memory only). */
  const [track, setTrack] = useState<GpsFix[]>([]);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);


  // Hydrate stored choice after mount so SSR markup matches.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "granted" || stored === "denied") setConsent(stored);
    } catch {
      /* storage blocked — stay at unknown */
    }
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation?.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => {
    if (consent !== "granted") {
      stop();
      setFix(null);
      setSmoothed(null);
      setTrack([]);
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("This browser can't share a location.");
      return;
    }
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: GpsFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        };
        setFix(next);
        setSmoothed((prev) => {
          if (!prev) return next;
          // Exponential smoothing; trust precise fixes more than fuzzy ones.
          const alpha = Math.min(0.9, Math.max(0.15, 25 / (25 + next.accuracy)));
          return {
            lat: prev.lat + (next.lat - prev.lat) * alpha,
            lon: prev.lon + (next.lon - prev.lon) * alpha,
            accuracy: prev.accuracy + (next.accuracy - prev.accuracy) * 0.4,
            at: next.at,
          };
        });
        setTrack((prev) => {
          const cutoff = next.at - TRACK_WINDOW_MS;
          const last = prev[prev.length - 1];
          // Throttle the trail to one point every ~5s to keep it scrubbable.
          const merged = last && next.at - last.at < 5_000 ? [...prev.slice(0, -1), next] : [...prev, next];
          return merged.filter((f) => f.at >= cutoff);
        });
      },
      (err) => setError(err.message || "Location unavailable."),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return stop;
  }, [consent, stop]);


  const choose = useCallback((next: Exclude<GpsConsent, "unknown">) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    setConsent(next);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setConsent("unknown");
  }, []);

  return {
    consent,
    fix,
    track,
    error,
    allow: () => choose("granted"),
    deny: () => choose("denied"),
    reset,
  };

}
