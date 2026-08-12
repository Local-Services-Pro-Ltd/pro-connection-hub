import { useEffect, useRef, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  CHANGE_EVENT,
  OPEN_EVENT,
  readCookiePrefs,
  writeCookiePrefs,
} from "@/lib/cookie-consent";
import { Action } from "@/components/site-chrome";

export function CookieConsent() {
  const [banner, setBanner] = useState(false);
  const [panel, setPanel] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [personalisation, setPersonalisation] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = readCookiePrefs();
    if (stored) {
      setAnalytics(stored.analytics);
      setPersonalisation(stored.personalisation);
    } else {
      setBanner(true);
    }
    const open = () => {
      const current = readCookiePrefs();
      setAnalytics(current?.analytics ?? false);
      setPersonalisation(current?.personalisation ?? false);
      setPanel(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (!panel) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  function save(next: { analytics: boolean; personalisation: boolean }) {
    writeCookiePrefs(next);
    setAnalytics(next.analytics);
    setPersonalisation(next.personalisation);
    setBanner(false);
    setPanel(false);
  }

  return (
    <>
      {banner && !panel && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/98 backdrop-blur-xl"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              <Cookie className="mr-2 inline h-4 w-4 text-primary" />
              We use cookies that keep the site working, plus optional ones for
              analytics and personalised results. You choose.{" "}
              <Link to="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Action variant="ghost" onClick={() => setPanel(true)}>
                Manage preferences
              </Action>
              <Action
                variant="outline"
                onClick={() => save({ analytics: false, personalisation: false })}
              >
                Reject optional
              </Action>
              <Action onClick={() => save({ analytics: true, personalisation: true })}>
                Accept all
              </Action>
            </div>
          </div>
        </div>
      )}

      {panel && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-prefs-title"
            className="w-full max-w-lg rounded-t-lg border border-border bg-card p-6 shadow-xl sm:rounded-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="cookie-prefs-title" className="font-display text-xl font-bold">
                Cookie preferences
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setPanel(false)}
                aria-label="Close cookie preferences"
                className="grid h-8 w-8 place-items-center rounded-sm border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-5 space-y-4">
              <li className="rounded-sm border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold">Strictly necessary</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Always on
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Sign-in sessions, security, and remembering your theme or
                  consent choices. The site can't work without these.
                </p>
              </li>

              <ToggleRow
                label="Analytics"
                description="Anonymous page and search statistics so we can see which trades and areas people struggle to find."
                checked={analytics}
                onChange={setAnalytics}
              />
              <ToggleRow
                label="Personalisation"
                description="Remembers your recent searches and location so results and quotes are closer to where you are."
                checked={personalisation}
                onChange={setPersonalisation}
              />
            </ul>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Action
                variant="outline"
                onClick={() => save({ analytics: false, personalisation: false })}
              >
                Reject optional
              </Action>
              <Action onClick={() => save({ analytics, personalisation })}>
                Save preferences
              </Action>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="rounded-sm border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${label} cookies`}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            checked ? "border-primary bg-primary" : "border-border bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${
              checked ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </li>
  );
}
