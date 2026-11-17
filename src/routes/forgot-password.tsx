import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import { Section } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { verifyPasswordRecoveryCheck } from "@/lib/password-recovery.functions";
import { PASSWORD_RESET_NEUTRAL_MESSAGE } from "@/lib/password-recovery";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password | TradesmanFinder" },
      {
        name: "description",
        content: "Request a secure link to reset your TradesmanFinder account password.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Forgot password — TradesmanFinder" },
      {
        property: "og:description",
        content: "Request a secure link to reset your TradesmanFinder account password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

function ForgotPassword() {
  const check = useHumanCheck();
  const verifyCheck = useServerFn(verifyPasswordRecoveryCheck);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await verifyCheck({
        data: {
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          website: check.state.website,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please redo the quick human check.");
      check.refresh();
      setBusy(false);
      return;
    }

    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Auth errors deliberately produce the same response, so this form cannot
      // reveal whether an email belongs to an account.
    }

    setSent(true);
    setCooldown(60);
    check.refresh();
    setBusy(false);
  }

  return (
    <Section>
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-3 text-4xl leading-tight">Forgot your password?</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Enter your account email and we'll send you a secure reset link.
        </p>

        {sent && (
          <p role="status" className="mt-6 rounded-md border border-border bg-card p-5 text-sm">
            {PASSWORD_RESET_NEUTRAL_MESSAGE}
          </p>
        )}

        <form
          onSubmit={submit}
          className="mt-8 space-y-5 rounded-md border border-border bg-card p-7"
        >
          <label className="block">
            <span className="eyebrow">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              className={`${field} mt-2`}
            />
          </label>

          <HumanCheck {...check} inputClassName={field} />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || cooldown > 0}
            className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Sending…" : cooldown > 0 ? `Try again in ${cooldown}s` : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/signin" search={{}} className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </Section>
  );
}
