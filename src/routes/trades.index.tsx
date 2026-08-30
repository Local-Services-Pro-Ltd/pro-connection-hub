import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { PageHero, Section } from "@/components/layout-bits";
import { SearchBar } from "@/components/search-bar";
import { tradesQuery, proCountsQuery } from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { tradeHero, hasTradePhoto } from "@/lib/trade-media";
import heroTrades from "@/assets/hero-trades.jpg";


export const Route = createFileRoute("/trades/")({
  loader: async ({ context }) => {
    const [, , origin] = await Promise.all([
      context.queryClient.ensureQueryData(tradesQuery),
      context.queryClient.ensureQueryData(proCountsQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const title = "All trades — find a vetted UK tradesman | TradesmanFinder";
    const description =
      "Browse every trade on TradesmanFinder — builders, plumbers, electricians, roofers, tilers and more. Typical costs and local availability.";
    const base = loaderData?.origin ?? "";
    const image = loaderData?.origin
      ? `${loaderData.origin}/og/trades.jpg`
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: "All trades — TradesmanFinder" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/trades` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "All trades — TradesmanFinder" },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: "UK tradespeople at work in a warmly lit workshop",
              },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${base}/trades` }],
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
      <p className="text-muted-foreground">No trades found.</p>
    </Section>
  ),
  component: TradesIndex,
});

function TradesIndex() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const { data: counts } = useSuspenseQuery(proCountsQuery);
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState<string>("all");

  const letters = useMemo(
    () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    [],
  );
  const available = useMemo(
    () => new Set(trades.map((t) => t.name.charAt(0).toUpperCase())),
    [trades],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trades.filter((t) => {
      const matchesLetter =
        letter === "all" || t.name.charAt(0).toUpperCase() === letter;
      const matchesQuery =
        !needle ||
        t.name.toLowerCase().includes(needle) ||
        t.blurb.toLowerCase().includes(needle) ||
        t.slug.includes(needle.replace(/\s+/g, "-"));
      return matchesLetter && matchesQuery;
    });
  }, [trades, q, letter]);


  return (
    <>
      <PageHero
        eyebrow="Directory"
        title="Every trade, vetted the same way."
        sub="ID check, insurance check, trade certification. No paid placement — ranking is based on reviews and response time."
        image={heroTrades}
        imageAlt="Builders, an electrician and a plumber at work in a warmly lit workshop"
        focal="50% 45%"
        focalMobile="60% 50%"
      >
        <SearchBar compact />
      </PageHero>

      <Section>
        <div className="mb-8 flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Directory</p>
              <h2 className="mt-2 text-2xl">Popular trades and services</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {visible.length} of {trades.length} listed
            </p>
          </div>

          <label className="relative block">
            <span className="sr-only">Search trades and services</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search e.g. Electrician, Plumber, Roofer…"
              className="w-full rounded-md border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>

          <div
            role="group"
            aria-label="Filter trades by first letter"
            className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 pb-1"
          >
            <button
              type="button"
              onClick={() => setLetter("all")}
              aria-pressed={letter === "all"}
              className={`shrink-0 snap-start rounded-md border px-3 py-1.5 text-sm transition-colors ${
                letter === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {letters.map((l) => {
              const enabled = available.has(l);
              const active = letter === l;
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setLetter(active ? "all" : l)}
                  aria-pressed={active}
                  className={`w-9 shrink-0 snap-start rounded-md border py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : enabled
                        ? "border-border bg-card text-muted-foreground hover:text-foreground"
                        : "border-border/60 bg-card text-muted-foreground/40"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-md border border-border bg-card p-8 text-sm text-muted-foreground">
            No trades match “{q}”. Try a different word, or{" "}
            <button
              type="button"
              className="text-primary underline underline-offset-4"
              onClick={() => {
                setQ("");
                setLetter("all");
              }}
            >
              clear the filters
            </button>
            .
          </p>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
            {visible.map((t) => (
              <Link
                key={t.slug}
                to="/trades/$trade"
                params={{ trade: t.slug }}
                search={{}}
                className="group flex flex-col bg-card transition-colors hover:bg-surface"
              >
                <img
                  src={tradeHero(t.slug)}
                  alt={
                    hasTradePhoto(t.slug)
                      ? tradeAlt(t.slug, t.name)
                      : "A UK residential street where our tradespeople work"
                  }
                  loading="lazy"
                  width={1600}
                  height={900}
                  style={{
                    objectPosition: tradeFocal(t.slug).focal,
                  }}
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-xl">{t.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t.blurb}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                  </div>
                  <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
                    <div>
                      <dt className="eyebrow">Typical cost</dt>
                      <dd className="mt-1">{t.typical_cost}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Available</dt>
                      <dd className="mt-1 text-primary">
                        {counts.byTrade[t.slug] ?? 0} local pros
                      </dd>
                    </div>
                  </dl>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

    </>
  );
}
