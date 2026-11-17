import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Building2 } from "lucide-react";
import { Section } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  getClaimableListing,
  submitListingClaim,
  type ClaimableListing,
} from "@/lib/claims.functions";

const SITE = "https://tradesmanfinder.org";
const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary";

const listingQuery = (proId: string) =>
  queryOptions({
    queryKey: ["claimable-listing", proId],
    queryFn: () => getClaimableListing({ data: { proId } }),
  });

export const Route = createFileRoute("/claim/$proId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(listingQuery(params.proId)),
  head: ({ loaderData, params }) => {
    const company = (loaderData as ClaimableListing | undefined)?.company;
    const title = company
      ? `Claim ${company} | TradesmanFinder`
      : "Claim your listing | TradesmanFinder";
    const description = company
      ? `Sign in and submit a reviewed claim to manage ${company}'s TradesmanFinder listing.`
      : "Submit a reviewed claim to manage a TradesmanFinder listing.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/claim/${params.proId}` }],
    };
  },
  errorComponent: ({ error }) => (
    <Section>
      <div className="mx-auto max-w-3xl rounded-md border border-border bg-card p-8 text-center">
        <p role="alert" className="text-muted-foreground">
          {error.message}
        </p>
        <Link to="/join" hash="find" className="mt-5 inline-flex text-primary hover:underline">
          Search for another listing
        </Link>
      </div>
    </Section>
  ),
  component: ClaimListing,
});

function ListingSummary({ listing }: { listing: ClaimableListing }) {
  return (
    <div className="rounded-md border border-border bg-card p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <Building2 className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="eyebrow">Listing to claim</p>
          <h2 className="mt-2 text-2xl">{listing.company}</h2>
          <p className="mt-2 text-sm capitalize text-muted-foreground">
            {listing.trade.replaceAll("-", " ")} · {listing.area}
          </p>
          <span className="mt-4 inline-flex rounded-sm border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Vetting in progress
          </span>
        </div>
      </div>
    </div>
  );
}

function EmailAccount({ proId }: { proId: string }) {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/claim/${proId}`,
            data: { full_name: name },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setCheckEmail(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <div role="status" className="mt-6 rounded-md border border-border bg-card p-7">
        <h2 className="text-2xl">Check your email.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We've sent a confirmation link to {email}. Open it to activate your account, then return
          to this listing to send your claim.
        </p>
        <button
          type="button"
          onClick={() => {
            setCheckEmail(false);
            setMode("in");
          }}
          className="mt-5 text-sm font-semibold text-primary hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-md border border-border bg-card p-7 sm:p-8">
      <h2 className="text-2xl">
        {mode === "up" ? "Create an account to claim it." : "Sign in to claim it."}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your account is not linked to the listing until an admin has reviewed and approved your
        claim.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-5">
        {mode === "up" && (
          <label className="block">
            <span className="eyebrow">Full name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={field}
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
            autoComplete="email"
            className={field}
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
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            className={field}
          />
        </label>
        {mode === "in" && (
          <div className="-mt-3 text-right">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
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
          {busy ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "up" ? "in" : "up");
          setError("");
        }}
        className="mt-5 text-sm text-muted-foreground hover:text-primary"
      >
        {mode === "up" ? "Already have an account? Sign in" : "No account? Create one"}
      </button>
    </div>
  );
}

function ClaimForm({ listing }: { listing: ClaimableListing }) {
  const { user } = useAuth();
  const submit = useServerFn(submitListingClaim);
  const successRef = useRef<HTMLDivElement>(null);
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({
    fullName: String(user?.user_metadata?.["full_name"] ?? ""),
    role: "",
    workEmail: user?.email ?? "",
    phone: "",
  });
  const mutation = useMutation({
    mutationFn: () => submit({ data: { proId: listing.id, ...form, consent } }),
  });

  useEffect(() => {
    if (mutation.isSuccess)
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [mutation.isSuccess]);

  if (mutation.isSuccess) {
    return (
      <div
        ref={successRef}
        role="status"
        className="mt-6 rounded-md border border-border bg-card p-8 text-center"
      >
        <BadgeCheck className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl">Thanks — we've got your claim.</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          A member of our compliance and onboarding team will reply within 2 working days.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account is not linked to the listing yet. We'll email you after the review.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="mt-6 rounded-md border border-border bg-card p-7 sm:p-8"
    >
      <h2 className="text-2xl">Tell us about your role.</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        An admin will review your claim before connecting your account.
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="eyebrow">Full name *</span>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            autoComplete="name"
            className={field}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="eyebrow">Role at the business *</span>
          <select
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={field}
          >
            <option value="">Choose your role</option>
            {["Owner", "Director", "Partner", "Employee"].map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Work email *</span>
          <input
            required
            type="email"
            value={form.workEmail}
            onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
            autoComplete="email"
            className={field}
          />
        </label>
        <label className="block">
          <span className="eyebrow">Phone *</span>
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            autoComplete="tel"
            className={field}
          />
        </label>
      </div>
      <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed">
        <input
          required
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-primary"
        />
        <span>I confirm I'm authorised to manage this business's listing.</span>
      </label>
      {mutation.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-7 w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Send claim for review"}
      </button>
    </form>
  );
}

function ClaimListing() {
  const { proId } = Route.useParams();
  const { data: listing } = useSuspenseQuery(listingQuery(proId));
  const { user, loading } = useAuth();

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Claim your listing</p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Manage your business on TradesmanFinder.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Confirm you're authorised to manage this listing. Our compliance and onboarding team
          reviews every claim.
        </p>
        <div className="mt-8">
          <ListingSummary listing={listing} />
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Checking your account…</p>
        ) : user ? (
          <ClaimForm key={user.id} listing={listing} />
        ) : (
          <EmailAccount proId={proId} />
        )}
      </div>
    </Section>
  );
}
