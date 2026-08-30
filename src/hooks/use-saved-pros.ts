import { useCallback, useEffect, useState } from "react";

const KEY = "tf.saved-pros";
const EVENT = "tf-saved-pros-changed";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Client-side shortlist of tradespeople, kept in localStorage so visitors can
 * gather options before they are ready to sign in or post a job.
 */
export function useSavedPros() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = read().includes(id)
      ? read().filter((x) => x !== id)
      : [...read(), id];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
    return next.includes(id);
  }, []);

  return { ids, toggle, isSaved: (id: string) => ids.includes(id) };
}
