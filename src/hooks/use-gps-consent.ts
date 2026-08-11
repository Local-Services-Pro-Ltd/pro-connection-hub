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
export function useGpsConsent() {
  const [consent, setConsent] = useState<GpsConsent>("unknown");
  const [fix, setFix] = useState<GpsFix | null>(null);
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
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("This browser can't share a location.");
      return;
    }
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
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

  return { consent, fix, error, allow: () => choose("granted"), deny: () => choose("denied"), reset };
}
