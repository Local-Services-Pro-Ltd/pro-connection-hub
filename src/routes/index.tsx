import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, Quote, Star } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { ProCard } from "@/components/pro-card";
import { Section, SectionHead } from "@/components/layout-bits";
import {
  tradesQuery,
  areasQuery,
  prosQuery,
  statsQuery,
  latestReviewsQuery,
  proCountsQuery,
} from "@/lib/queries";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import heroVideo from "@/assets/hero.mp4.asset.json";
import heroPoster from "@/assets/hero-poster.jpg";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    const qc = context.queryClient;
    return Promise.all([
      qc.ensureQueryData(tradesQuery),
      qc.ensureQueryData(areasQuery),
      qc.ensureQueryData(prosQuery({ sort: "rating" })),
      qc.ensureQueryData(statsQuery),
      qc.ensureQueryData(latestReviewsQuery),
      qc.ensureQueryData(proCountsQuery),
    ]).then(() => null);
  },
  head: () => ({
    meta: [
      { title: "TradesmanFinder — Find a vetted local tradesman in the UK" },
      {
        name: "description",
        content:
          "Post your job for free and compare quotes from vetted builders, plumbers, electricians, roofers and more near you. No obligation, real reviews.",
      },
      {
        property: "og:title",
        content: "Find a vetted local tradesman — TradesmanFinder",
      },
      {
        property: "og:description",
        content:
          "Free to post, quotes usually within hours, every trade ID-checked and insured.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
    body: "We match you with vetted local trades who are actually available for the dates you want.",
  },
  {
    n: "03",
    title: "Hire on the evidence",
    body: "Compare price, availability and written reviews from real jobs. Then leave one of your own.",
  },
];

function Home() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const { data: areas } = useSuspenseQuery(areasQuery);
  const { data: pros } = useSuspenseQuery(prosQuery({ sort: "rating" }));
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: reviews } = useSuspenseQuery(latestReviewsQuery);
  const { data: counts } = useSuspenseQuery(proCountsQuery);
  const reducedMotion = usePrefersReducedMotion();

  const ledger = [
    { value: String(stats.pros), label: "Verified tradesmen" },
    { value: String(stats.trades), label: "Trades covered" },
    {
      value: stats.avgResponse ? `${stats.avgResponse} min` : "—",
      label: "Average response",
    },
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
            aria-hidden="true"
          />
        )}

        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-5 py-24 lg:px-8">
          <p className="eyebrow">Vetted UK trades</p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            Find a tradesman who picks up{" "}
            <span className="ember-text">on the first call.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Post your job free and get quotes from ID-checked builders,
            plumbers and electricians in your area — usually within hours.
          </p>

          <div className="mt-9 max-w-3xl">
            <SearchBar />
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
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
          sub="Every firm on the network is ID-verified, insured and holds the certification their trade requires."
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
                {counts.byTrade[t.slug] ?? 0} local pros
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

      {/* Featured pros */}
      <Section>
        <SectionHead
          eyebrow="Featured tradesmen"
          title="People who turn up."
          sub="The highest-rated firms currently taking work."
        />
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pros.slice(0, 6).map((p) => (
            <ProCard key={p.id} pro={p} />
          ))}
        </div>
      </Section>

      {/* Reviews */}
      <Section className="border-y border-border bg-surface">
        <SectionHead eyebrow="Reviews" title="Written by people who paid." />
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
                {r.author_place ? ` · ${r.author_place}` : ""}
                {r.job_type ? ` · ${r.job_type}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Areas + CTA */}
      <Section>
        <SectionHead
          eyebrow="Areas"
          title="Covering the whole of the UK."
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
          {areas.map((a) => (
            <Link
              key={a.slug}
              to="/trades"
              className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {a.name}
              <span className="ml-2 text-xs text-primary">
                {counts.byArea[a.slug] ?? 0}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-16 overflow-hidden rounded-md border border-border bg-card p-8 lg:p-14">
          <div className="grid items-end gap-8 lg:grid-cols-[1.4fr_auto]">
            <div className="max-w-xl">
              <h2 className="text-3xl leading-tight sm:text-4xl">
                Got a job that needs doing?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Post it in two minutes. You'll hear back from up to three local
                trades, usually the same day.
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
