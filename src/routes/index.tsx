import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Flame,
  Hammer,
  HardHat,
  Home as HomeIcon,
  IdCard,
  MessageSquareQuote,
  Paintbrush,
  Quote,
  ShieldCheck,
  Star,
  Wrench,
  Zap,
  Droplets,
  type LucideIcon,
} from "lucide-react";
import { SearchBar } from "@/components/search-bar";
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
import heroPoster from "@/assets/hero-poster.jpg";

const HERO_VIDEO_URL = "/media/hero.mp4";

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
    const image = loaderData?.origin ? `${loaderData.origin}/og/home.jpg` : undefined;
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
    body: "We match you with local trades as they join. Firms must complete ID and insurance checks before they can quote.",
  },
  {
    n: "03",
    title: "Hire on the evidence",
    body: "Compare services, experience and reviews from customers who've had work done through TradesmanFinder.",
  },
];

const POPULAR_TRADES: { slug: string; icon: LucideIcon }[] = [
  { slug: "plumber", icon: Droplets },
  { slug: "electrician", icon: Zap },
  { slug: "builder", icon: HardHat },
  { slug: "roofer", icon: HomeIcon },
  { slug: "gas-heating-engineer", icon: Flame },
  { slug: "painter-decorator", icon: Paintbrush },
  { slug: "carpenter", icon: Hammer },
  { slug: "handyman", icon: Wrench },
];

const TRUST_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: IdCard,
    title: "ID checked",
    body: "We confirm who's behind every firm before it can quote.",
  },
  {
    icon: ShieldCheck,
    title: "Insurance checked",
    body: "Public liability insurance, plus any trade registration the work needs, such as Gas Safe or NICEIC.",
  },
  {
    icon: MessageSquareQuote,
    title: "Real reviews only",
    body: "Reviews come only from customers who've had work done through TradesmanFinder.",
  },
];

function Home() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const { data: areas } = useSuspenseQuery(areasQuery);
  const { data: featuredPros } = useSuspenseQuery(featuredProsQuery);
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: reviews } = useSuspenseQuery(latestReviewsQuery);
  const popular = POPULAR_TRADES.flatMap(({ slug, icon }) => {
    const t = trades.find((x) => x.slug === slug);
    return t ? [{ ...t, icon }] : [];
  });
  const reducedMotion = usePrefersReducedMotion();

  const ledger = [
    { value: String(stats.trades), label: "Trade categories" },
    { value: "Up to 3", label: "Quotes per job" },
    { value: "£0", label: "To post a job" },
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
            src={HERO_VIDEO_URL}
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
            Find a qualified local tradesman <span className="ember-text">who delivers.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed hero-ink-muted">
            Post your job free and we'll match you with local trades as they join — ID-checked and
            insured before they can quote.
          </p>

          <div className="mt-9 max-w-3xl">
            <SearchBar />
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm hero-ink-muted">
            {["Free to post", "No obligation", "Written reviews only"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stats ledger */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-border border-border px-0 sm:grid-cols-3 sm:divide-y-0">
          {ledger.map((s) => (
            <div key={s.label} className="px-6 py-8 lg:px-8 lg:py-10">
              <p className="font-display text-3xl font-bold lg:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trades — slightly tighter padding than other sections to keep the page short */}
      <section className="px-5 py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHead
            eyebrow="Browse by trade"
            title="Every trade, one onboarding standard."
            sub="We're onboarding local trades now. Every firm completes ID and insurance checks before it can quote."
          />
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4">
            {popular.map((t) => (
              <Link
                key={t.slug}
                to="/trades/$trade"
                params={{ trade: t.slug }}
                search={{}}
                className="group flex flex-col gap-3 bg-card p-4 transition-colors hover:bg-surface sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <t.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <div>
                  <h3 className="text-base leading-snug">{t.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {t.blurb}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/trades"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            See all {stats.trades} trades <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <Section className="border-y border-border bg-surface">
        <SectionHead eyebrow="How it works" title="Three steps, no phone tag." />
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-card p-8">
              <span className="font-display text-5xl font-bold text-primary/25">{s.n}</span>
              <h3 className="mt-6 text-xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Featured pros — only shown once real, hand-picked firms exist. */}
      {featuredPros.length > 0 && (
        <Section>
          <SectionHead
            eyebrow="Featured tradesmen"
            title="People who turn up."
            sub="Hand-picked firms we've checked ourselves — insurance, trade bodies and past work."
          />
          <div
            data-testid="featured-pros"
            className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {featuredPros.map((p) => (
              <ProCard key={p.id} pro={p} />
            ))}
          </div>
        </Section>
      )}

      {/* Trust */}
      <Section>
        <SectionHead eyebrow="Trust" title="How we keep it trustworthy" />
        <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
          {TRUST_POINTS.map((p) => (
            <div key={p.title} className="flex gap-4 bg-card p-6">
              <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-lg">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Reviews — only shown once real customer reviews exist. */}
      {reviews.length > 0 && (
        <Section className="border-y border-border bg-surface">
          <SectionHead eyebrow="Reviews" title="What customers say" />
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
                <blockquote className="mt-5 flex-1 text-base leading-relaxed">{r.body}</blockquote>
                <figcaption className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                  <span className="text-foreground">{r.author_name}</span>
                  {r.job_type ? ` · ${r.job_type}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

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
              <h2 className="text-3xl leading-tight sm:text-4xl">Got a job that needs doing?</h2>
              <p className="mt-4 text-muted-foreground">
                Post it in two minutes. We'll match you with up to three local trades as they join
                and complete their checks.
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
