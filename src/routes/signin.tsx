import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { googleReturnUrl, safeAuthDestination, usesLovableAuth } from "@/lib/auth-redirect";
import heroPoster from "@/assets/hero-poster.jpg";

type SignInSearch = {
  redirect?: string;
  /** Membership tier the trade picked on /for-tradesmen. Any slug is accepted,
   *  including tiers currently hidden from the pricing grid (e.g. contractor). */
  plan?: string;
  /** "claim" = trade claiming an existing listing rather than a fresh signup. */
  intent?: "claim";
};

export const Route = createFileRoute("/signin")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    ...(typeof search["redirect"] === "string"
      ? { redirect: safeAuthDestination(search["redirect"]) }
      : {}),
    ...(typeof search["plan"] === "string" && search["plan"]
      ? { plan: search["plan"] }
      : {}),
    ...(search["intent"] === "claim" ? { intent: "claim" as const } : {}),
  }),

  head: () => ({
    meta: [
      { title: "Sign in | TradesmanFinder" },
      {
        name: "description",
        content:
          "Sign in to manage your posted jobs, quotes and reviews on TradesmanFinder.",
      },
      { property: "og:title", content: "Sign in — TradesmanFinder" },
      {
        property: "og:description",
        content: "Manage your jobs, quotes and reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignIn,
});

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary";

function SignIn() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading } = useAuth();
  // Arriving from a pricing tier or a "claim your listing" link means the
  // trade almost certainly needs an account, so open on sign-up.
  const isTradeIntent = Boolean(search.plan || search.intent === "claim");
  const [mode, setMode] = useState<"in" | "up">(isTradeIntent ? "up" : "in");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const dest = search.redirect ?? "/account";

  useEffect(() => {
    if (!loading && user) navigate({ to: dest, replace: true });
  }, [loading, user, dest, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    try {
      const redirectTo = googleReturnUrl(window.location.origin, dest);
      const result = usesLovableAuth(window.location.hostname)
        ? await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo })
        : await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo },
          });
      if (result.error) throw result.error;
    } catch {
      toast.error("Google sign-in failed. Please try again or use your email and password.");
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center px-5 py-16 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <p className="eyebrow">
            {search.intent === "claim"
              ? "Claim your listing"
              : search.plan
                ? `${search.plan} membership`
                : mode === "in"
                  ? "Welcome back"
                  : "Create an account"}
          </p>
          <h1 className="mt-3 text-4xl leading-tight">
            {mode === "in" ? "Sign in." : "Join up."}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {search.intent === "claim"
              ? "Create an account with the email on your listing and we'll match it up, or sign in if you already have one."
              : search.plan
                ? "Create your account first — we'll set up your membership straight after."
                : "Manage your jobs, quotes and reviews in one place."}
          </p>


          {checkEmail ? (
            <div className="mt-8 rounded-md border border-border bg-card p-6 text-sm">
              <p className="font-display text-base">Check your email</p>
              <p className="mt-2 text-muted-foreground">
                We've sent a confirmation link to {email}. Click it to activate
                your account, then come back and sign in.
              </p>
              <button
                onClick={() => {
                  setCheckEmail(false);
                  setMode("in");
                }}
                className="mt-4 text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={google}
                disabled={googleBusy}
                className="mt-8 flex w-full items-center justify-center gap-3 rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.65 4.1-5.35 4.1a5.9 5.9 0 1 1 0-11.8c1.68 0 2.8.72 3.45 1.33l2.35-2.27C16.3 3.9 14.36 3 12 3a9 9 0 1 0 0 18c5.2 0 8.64-3.65 8.64-8.8 0-.6-.06-1.05-.29-2.1Z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="space-y-5">
                {mode === "up" && (
                  <label className="block">
                    <span className="eyebrow">Full name</span>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      className={`${field} mt-2`}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="eyebrow">Email</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="eyebrow">Password</span>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${field} mt-2`}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                >
                  {busy
                    ? "Please wait…"
                    : mode === "in"
                      ? "Sign in"
                      : "Create account"}
                </button>
              </form>

              <button
                onClick={() => setMode(mode === "in" ? "up" : "in")}
                className="mt-5 text-sm text-muted-foreground hover:text-primary"
              >
                {mode === "in"
                  ? "No account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </>
          )}

          <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            Are you a trade?{" "}
            <Link to="/for-tradesmen" className="text-primary hover:underline">
              Apply to join the network
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border lg:block">
        <img
          src={heroPoster}
          alt="A tradesman on a UK renovation site"
          loading="lazy"
          width={1920}
          height={1088}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/55" />
        <blockquote className="absolute bottom-12 left-12 right-12 font-display text-2xl leading-snug">
          "Three quotes in under two hours, all with photos of previous work."
          <footer className="mt-4 font-sans text-sm text-muted-foreground">
            Hannah D. — Bristol
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
