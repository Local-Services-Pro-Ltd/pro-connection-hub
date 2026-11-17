import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Section } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { EXPIRED_RESET_LINK_MESSAGE, validatePasswordReset } from "@/lib/password-recovery";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | TradesmanFinder" },
      {
        name: "description",
        content: "Choose a new password for your TradesmanFinder account.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Reset password — TradesmanFinder" },
      {
        property: "og:description",
        content: "Choose a new password for your TradesmanFinder account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

type RecoveryState = "checking" | "ready" | "invalid" | "success";

function ResetPassword() {
  const [state, setState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let ready = false;
    let recoveryEvent = false;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = new URLSearchParams(window.location.search).get("code");
    const hashAccessToken = hash.get("type") === "recovery" ? hash.get("access_token") : null;
    const recoveryLink = Boolean(code || hashAccessToken);

    const showForm = () => {
      if (!active) return;
      ready = true;
      setState("ready");
      // Keep used recovery tokens out of browser history and subsequent reloads.
      window.history.replaceState(null, "", window.location.pathname);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === "PASSWORD_RECOVERY") {
        recoveryEvent = true;
        showForm();
      } else if (event === "SIGNED_IN" && code) {
        showForm();
      }
    });

    void (async () => {
      try {
        if (code && !ready) {
          // Newer Supabase clients exchange PKCE codes during initialisation and
          // emit SIGNED_IN. Otherwise, exchange explicitly rather than accepting
          // an unrelated session that happened to exist before the link opened.
          const exchanged = await supabase.auth.exchangeCodeForSession(code);
          if (exchanged.error) throw exchanged.error;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const hashSessionMatches =
          !hashAccessToken || data.session?.access_token === hashAccessToken;
        if (data.session && hashSessionMatches && (recoveryLink || recoveryEvent)) {
          showForm();
        } else if (!ready && active) {
          setState("invalid");
        }
      } catch {
        if (!ready && active) setState("invalid");
      }
    })();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validatePasswordReset(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setState("success");
    } catch {
      setError("We couldn't update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section>
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-3 text-4xl leading-tight">Reset your password.</h1>

        {state === "checking" && (
          <p
            role="status"
            className="mt-8 rounded-md border border-border bg-card p-6 text-muted-foreground"
          >
            Checking your reset link…
          </p>
        )}

        {state === "invalid" && (
          <div className="mt-8 rounded-md border border-border bg-card p-7">
            <p role="alert" className="leading-relaxed text-muted-foreground">
              {EXPIRED_RESET_LINK_MESSAGE}
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Request a new reset link
            </Link>
          </div>
        )}

        {state === "success" && (
          <div role="status" className="mt-8 rounded-md border border-border bg-card p-7">
            <h2 className="text-2xl">Password updated.</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Your new password is ready to use.
            </p>
            <Link
              to="/account"
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Go to your account
            </Link>
          </div>
        )}

        {state === "ready" && (
          <form
            noValidate
            onSubmit={submit}
            className="mt-8 space-y-5 rounded-md border border-border bg-card p-7"
          >
            <label className="block">
              <span className="eyebrow">New password</span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className={field}
              />
            </label>
            <label className="block">
              <span className="eyebrow">Confirm password</span>
              <input
                required
                type="password"
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                className={field}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
