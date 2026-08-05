import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { PageHero, Section } from "@/components/layout-bits";
import { SearchBar } from "@/components/search-bar";
import { tradesQuery, proCountsQuery } from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";
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
        <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {trades.map((t) => (
            <Link
              key={t.slug}
              to="/trades/$trade"
              params={{ trade: t.slug }}
              search={{}}
              className="group bg-card p-7 transition-colors hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl">{t.name}</h2>
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
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
