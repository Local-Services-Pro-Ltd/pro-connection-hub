import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, Quote, Star } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { VettingStatusPanel } from "@/components/vetting-status";
import { ProCard } from "@/components/pro-card";
import { Section, SectionHead } from "@/components/layout-bits";
import {
  tradesQuery,
  areasQuery,
  featuredProsQuery,
  statsQuery,
  latestReviewsQuery,
} from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import heroVideo from "@/assets/hero.mp4.asset.json";
import heroPoster from "@/assets/hero-poster.jpg";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const qc = context.queryClient;
    const [, , , , , origin] = await Promise.all([
      qc.ensureQueryData(tradesQuery),
      qc.ensureQueryData(areasQuery),
      qc.ensureQueryData(featuredProsQuery),
      qc.ensureQueryData(statsQuery),
      qc.ensureQueryData(latestReviewsQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const title = "TradesmanFinder — Find a qualified local tradesman";
    const description =
      "Post your job free and we'll match you with local trades as they join — ID-checked and insured before they can quote.";
    const base = loaderData?.origin ?? "";
    const image = loaderData?.origin
      ? `${loaderData.origin}/og/home.jpg`
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "Find a qualified local tradesman — TradesmanFinder",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/` },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "Find a qualified local tradesman — TradesmanFinder",
        },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: "UK tradespeople on site at golden hour",
              },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [
        { rel: "canonical", href: `${base}/` },
        {
          rel: "preload",
          as: "image",
          href: heroPoster,
          fetchpriority: "high",
        },
      ],

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
      <p className="text-muted-foreground">Nothing here.</p>
    </Section>
  ),
  component: Home,
});

const steps = [
  {
    n: "01",
    title: "Tell us the job",
    body: "Two minutes, plain English, photos if you have them. Free and no obligation.",
  },
  {
    n: "02",
    title: "Get up to 3 quotes",
    body: "We match you with local trades as they join. Every firm is ID-checked and its insurance confirmed before it can quote.",
  },
  {
    n: "03",
    title: "Hire on the evidence",
    body: "Compare services, experience and reviews from customers who've had work done through TradesmanFinder.",
  },
];

function Home() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const { data: areas } = useSuspenseQuery(areasQuery);
  const { data: featuredPros } = useSuspenseQuery(featuredProsQuery);
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: reviews } = useSuspenseQuery(latestReviewsQuery);
  const reducedMotion = usePrefersReducedMotion();

  const ledger = [
    { value: String(stats.trades), label: "Trades listed" },
    { value: "Up to 3", label: "Quotes per job" },
    { value: "£0", label: "To post a job" },
    { value: String(stats.reviews), label: "Customer reviews" },
  ];

  return (
    <>
      {/* Hero — cinematic video band (still poster when motion is reduced) */}
      <section className="relative isolate min-h-[88vh] max-h-[900px] overflow-hidden border-b border-border">
        {reducedMotion ? (
          <img
            data-hero-media
            className="absolute inset-0 h-full w-full object-cover"
            src={heroPoster}
            alt=""
            width={1600}
            height={900}
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <video
            data-hero-media
            className="absolute inset-0 h-full w-full object-cover"
            src={heroVideo.url}
            poster={heroPoster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />

        )}

        <div className="absolute inset-0 bg-background/32" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/22 to-transparent" />
        <div className="hero-copy-scrim pointer-events-none absolute inset-0" />


        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-5 py-24 lg:px-8">
          <p className="eyebrow hero-ink-muted">Local trades, carefully onboarded</p>
          <h1 className="mt-4 max-w-3xl hero-ink text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            Find a qualified local tradesman{" "}
            <span className="ember-text">who delivers.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed hero-ink-muted">
            Post your job free and we'll match you with local trades as they
            join — ID-checked and insured before they can quote.
          </p>

          <div className="mt-9 max-w-3xl">
            <SearchBar />
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm hero-ink-muted">
            {["Free to post", "No obligation", "Written reviews only"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      {/* Stats ledger */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-border border-border px-0 lg:grid-cols-4 lg:divide-y-0">
          {ledger.map((s) => (
            <div key={s.label} className="px-6 py-8 lg:px-8 lg:py-10">
              <p className="font-display text-3xl font-bold lg:text-4xl">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trades */}
      <Section>
        <SectionHead
          eyebrow="Browse by trade"
          title="Every trade, checked the same way."
          sub="We're onboarding local trades now. Every firm is ID-checked and its insurance confirmed before it can quote."
          aside={
            <Link
              to="/trades"
              className="hidden shrink-0 items-center gap-2 text-sm text-primary hover:underline sm:flex"
            >
              All trades <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {trades.map((t) => (
            <Link
              key={t.slug}
              to="/trades/$trade"
              params={{ trade: t.slug }}
              search={{}}
              className="group flex flex-col justify-between gap-6 bg-card p-6 transition-colors hover:bg-surface"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg">{t.name}</h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t.blurb}
                </p>
              </div>
              <p className="font-display text-xs uppercase tracking-widest text-primary">
                Now onboarding
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section className="border-y border-border bg-surface">
        <SectionHead eyebrow="How it works" title="Three steps, no phone tag." />
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-card p-8">
              <span className="font-display text-5xl font-bold text-primary/25">
                {s.n}
              </span>
              <h3 className="mt-6 text-xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Featured pros — only ever real, hand-picked firms. Until an admin
          features someone, we say what's actually happening instead. */}
      <Section>
        {featuredPros.length > 0 ? (
          <>
            <SectionHead
              eyebrow="Featured tradesmen"
              title="People who turn up."
              sub="Hand-picked firms we've checked ourselves — insurance, trade bodies and past work."
            />
            <div data-testid="featured-pros" className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredPros.map((p) => (
                <ProCard key={p.id} pro={p} />
              ))}
            </div>
          </>
        ) : (
          <div data-testid="vetting-status">
            <SectionHead
              eyebrow="Vetting in progress"
              title="No featured firms yet — on purpose."
              sub="We'd rather show you nobody than show you a name we haven't checked. Here's exactly where we've got to."
            />
            <VettingStatusPanel />
          </div>
        )}

      </Section>


      {/* Reviews */}
      <Section className="border-y border-border bg-surface">
        <SectionHead
          eyebrow="Reviews"
          title="Reviews will only come from customers who've had work done through TradesmanFinder."
        />
        {reviews.length === 0 ? (
          <p className="mt-8 rounded-md border border-border bg-card p-8 text-muted-foreground">
            No customer reviews yet. They'll appear here after work completed
            through TradesmanFinder has been reviewed.
          </p>
        ) : (
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-3">
          {reviews.slice(0, 3).map((r) => (
            <figure key={r.id} className="flex flex-col bg-card p-8">
              <div className="flex items-center justify-between">
                <Quote className="h-5 w-5 text-primary" />
                <span className="flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  {r.rating}
                </span>
              </div>
              <blockquote className="mt-5 flex-1 text-base leading-relaxed">
                {r.body}
              </blockquote>
              <figcaption className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                <span className="text-foreground">{r.author_name}</span>
                {r.job_type ? ` · ${r.job_type}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
        )}
      </Section>

      {/* Areas + CTA */}
      <Section>
        <SectionHead
          eyebrow="Areas"
          title="Local trades are joining area by area."
          sub="We're onboarding firms gradually and checking their ID and insurance before they can quote. Join the waiting list to hear when your area opens."
          aside={
            <Link
              to="/areas"
              className="hidden shrink-0 items-center gap-2 text-sm text-primary hover:underline sm:flex"
            >
              All areas <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="mt-8 flex flex-wrap gap-2">
          {areas
            .filter((a) => a.status === "live")
            .map((a) => (
              <Link
                key={a.slug}
                to="/trades"
                className="rounded-sm border border-primary/40 bg-primary/8 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {a.name}
                <span className="ml-2 text-xs text-primary">Now onboarding</span>
              </Link>
            ))}
          {areas
            .filter((a) => a.status !== "live")
            .map((a) => (
              <span
                key={a.slug}
                className="rounded-sm border border-dashed border-border px-4 py-2 text-sm text-muted-foreground/70"
              >
                {a.name}
                <span className="ml-2 text-xs">Coming soon</span>
              </span>
            ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Somewhere else?{" "}
          <Link to="/waiting-list" search={{}} className="text-primary hover:underline">
            Join the waiting list
          </Link>{" "}
          and we'll tell you the day we open your postcode.
        </p>


        <div className="mt-16 overflow-hidden rounded-md border border-border bg-card p-8 lg:p-14">
          <div className="grid items-end gap-8 lg:grid-cols-[1.4fr_auto]">
            <div className="max-w-xl">
              <h2 className="text-3xl leading-tight sm:text-4xl">
                Got a job that needs doing?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Post it in two minutes. We'll match you with up to three local
                trades as they join and complete their checks.
              </p>
            </div>
            <Link
              to="/post-job"
              search={{}}
              className="inline-flex items-center gap-2 self-start rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember transition-all hover:brightness-110 lg:self-end"
            >
              Post a job — free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
