import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PageHero, Section } from "@/components/layout-bits";
import heroPostJob from "@/assets/hero-post-job.jpg";
import { tradesQuery, budgetBands } from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Search = { trade?: string; pro?: string };

export const Route = createFileRoute("/post-job")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["trade"] === "string" && search["trade"]
      ? { trade: search["trade"] }
      : {}),
    ...(typeof search["pro"] === "string" && search["pro"]
      ? { pro: search["pro"] }
      : {}),
  }),
  loader: async ({ context }) => {
    const [, origin] = await Promise.all([
      context.queryClient.ensureQueryData(tradesQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const title = "Post a job free — get up to 3 quotes | TradesmanFinder";
    const description =
      "Describe your job in two minutes and get quotes from up to three vetted local tradesmen. Free to post, no obligation.";
    const image = loaderData?.origin
      ? `${loaderData.origin}/og/post-job.jpg`
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: "Post a job free — TradesmanFinder" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/post-job" },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "Post a job free — TradesmanFinder",
        },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: "A homeowner's kitchen mid-renovation",
              },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: "/post-job" }],
    };
  },

  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  notFoundComponent: () => (
    <Section>
      <p className="text-muted-foreground">Not found.</p>
    </Section>
  ),
  component: PostJob,
});

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

const timings = [
  "As soon as possible",
  "Within 2 weeks",
  "Within a month",
  "Flexible / planning ahead",
];

const ukPostcode =
  /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function PostJob() {
  const search = Route.useSearch();
  const { user } = useAuth();
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const [reference, setReference] = useState<string | null>(null);

  const [form, setForm] = useState({
    trade_slug: search.trade ?? "",
    postcode: "",
    title: "",
    description: "",
    timing: timings[0]!,
    budget_band: "any",
    contact_name: "",
    contact_email: "",
  });

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const errors: string[] = [];
      if (!form.trade_slug) errors.push("Choose a trade.");
      if (!ukPostcode.test(form.postcode.trim()))
        errors.push("Enter a valid UK postcode.");
      if (form.title.trim().length < 6)
        errors.push("Give the job a clearer title.");
      if (form.description.trim().length < 25)
        errors.push("Describe the job in a little more detail (25+ chars).");
      if (!/^\S+@\S+\.\S+$/.test(form.contact_email.trim()))
        errors.push("Enter a valid email address.");
      if (form.contact_name.trim().length < 2) errors.push("Enter your name.");
      if (errors.length) throw new Error(errors[0]);

      const row = {
        trade_slug: form.trade_slug,
        postcode: form.postcode.trim().toUpperCase(),
        title: form.title.trim().slice(0, 140),
        description: form.description.trim().slice(0, 4000),
        timing: form.timing,
        budget_band: form.budget_band,
        contact_name: form.contact_name.trim().slice(0, 80),
        contact_email: form.contact_email.trim().toLowerCase(),
        user_id: user?.id ?? null,
      };

      // Guests can post but cannot read jobs back, so only signed-in
      // customers get the stored reference returned.
      if (user) {
        const { data, error } = await supabase
          .from("jobs")
          .insert(row)
          .select("reference")
          .single();
        if (error) throw error;
        return data.reference as string;
      }
      const { error } = await supabase.from("jobs").insert(row);
      if (error) throw error;
      return "";
    },
    onSuccess: (ref) => {
      setReference(ref);
      toast.success("Job posted — matching local trades now");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHero
        eyebrow="Post a job"
        title="Tell us what needs doing."
        sub="Two minutes. Free. Up to three vetted local trades will come back to you — usually the same day."
        image={heroPostJob}
        imageAlt="A kitchen mid-renovation with a notepad and tape measure on the worktop"
        focal="50% 50%"
        focalMobile="58% 55%"
      />


      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          {reference !== null ? (
            <div className="rounded-md border border-border bg-card p-10">
              <div className="grid h-12 w-12 place-items-center rounded-sm bg-primary/15">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-6 text-2xl">Job posted</h2>
              <p className="mt-3 max-w-md text-muted-foreground">
                {reference ? (
                  <>
                    Your reference is{" "}
                    <strong className="font-display text-foreground">
                      {reference}
                    </strong>
                    .{" "}
                  </>
                ) : null}
                We're matching vetted trades covering{" "}
                {form.postcode.toUpperCase()} now — you'll hear from up to three
                of them.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setReference(null)}
                  className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
                >
                  Post another job
                </button>
                {user ? (
                  <Link
                    to="/account"
                    className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
                  >
                    View my jobs
                  </Link>
                ) : (
                  <Link
                    to="/signin"
                    search={{}}
                    className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
                  >
                    Create an account to track it
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="space-y-6 rounded-md border border-border bg-card p-6 lg:p-9"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Trade needed</span>
                  <select
                    required
                    value={form.trade_slug}
                    onChange={(e) => set("trade_slug")(e.target.value)}
                    className={`${field} mt-2`}
                  >
                    <option value="">Choose a trade</option>
                    {trades.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Postcode</span>
                  <input
                    required
                    value={form.postcode}
                    onChange={(e) => set("postcode")(e.target.value)}
                    placeholder="e.g. BS1 4DJ"
                    className={`${field} mt-2`}
                  />
                </label>
              </div>

              <label className="block">
                <span className="eyebrow">Job title</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => set("title")(e.target.value)}
                  maxLength={140}
                  placeholder="Replace leaking bathroom radiator"
                  className={`${field} mt-2`}
                />
              </label>

              <label className="block">
                <span className="eyebrow">Describe the job</span>
                <textarea
                  required
                  rows={6}
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  maxLength={4000}
                  placeholder="What needs doing, access details, anything a trade should know before quoting."
                  className={`${field} mt-2 resize-y`}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {form.description.trim().length}/4000
                </span>
              </label>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">When</span>
                  <select
                    value={form.timing}
                    onChange={(e) => set("timing")(e.target.value)}
                    className={`${field} mt-2`}
                  >
                    {timings.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Budget guide</span>
                  <select
                    value={form.budget_band}
                    onChange={(e) => set("budget_band")(e.target.value)}
                    className={`${field} mt-2`}
                  >
                    {budgetBands.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.value === "any" ? "Not sure yet" : b.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Your name</span>
                  <input
                    required
                    value={form.contact_name}
                    onChange={(e) => set("contact_name")(e.target.value)}
                    maxLength={80}
                    className={`${field} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="eyebrow">Email</span>
                  <input
                    required
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => set("contact_email")(e.target.value)}
                    className={`${field} mt-2`}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember transition-all hover:brightness-110 disabled:opacity-60"
              >
                {mutation.isPending ? "Posting…" : "Post job — free"}
              </button>
            </form>
          )}

          <aside className="h-fit space-y-6 rounded-md border border-border bg-surface p-6 lg:sticky lg:top-24">
            <div>
              <p className="eyebrow">What happens next</p>
              <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">1.</strong> We match your
                  job to vetted trades covering your postcode.
                </li>
                <li>
                  <strong className="text-foreground">2.</strong> Up to three of
                  them contact you with a price and availability.
                </li>
                <li>
                  <strong className="text-foreground">3.</strong> You choose —
                  or you don't. There's no fee either way.
                </li>
              </ol>
            </div>
            <div className="border-t border-border pt-6 text-sm text-muted-foreground">
              We never sell your details, and your phone number is only shared
              with trades you choose to speak to.
              {!user && (
                <>
                  {" "}
                  <Link to="/signin" search={{}} className="text-primary hover:underline">
                    Sign in
                  </Link>{" "}
                  to track quotes in your account.
                </>
              )}
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
