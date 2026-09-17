import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHero, Section } from "@/components/layout-bits";
import { ProCard } from "@/components/pro-card";
import { directoryQuery, tradesQuery, type Pro } from "@/lib/queries";

export const Route = createFileRoute("/directory")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(directoryQuery),
      context.queryClient.ensureQueryData(tradesQuery),
    ]);
  },
  head: () => ({
    meta: [
      {
        title: "Firm directory — vetted tradesmen by trade | TradesmanFinder",
      },
      {
        name: "description",
        content:
          "Browse every vetted firm on TradesmanFinder by trade, with photos, ratings and reviews across Greater London, Kent and Surrey.",
      },
      { property: "og:title", content: "Firm directory — TradesmanFinder" },
      {
        property: "og:description",
        content:
          "Every vetted firm on TradesmanFinder, grouped by trade with photos and reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://tradesmanfinder.org/directory" }],
  }),
  component: Directory,
});

function Directory() {
  const { data: pros } = useSuspenseQuery(directoryQuery);
  const { data: trades } = useSuspenseQuery(tradesQuery);

  const byTrade = new Map<string, Pro[]>();
  for (const pro of pros) {
    const list = byTrade.get(pro.trade_slug) ?? [];
    list.push(pro);
    byTrade.set(pro.trade_slug, list);
  }

  const groups = trades
    .map((trade) => ({ trade, firms: byTrade.get(trade.slug) ?? [] }))
    .filter((g) => g.firms.length > 0);

  const realCount = pros.filter((p) => !p.is_demo).length;
  const exampleCount = pros.length - realCount;

  return (
    <>
      <PageHero
        eyebrow="Directory"
        title="Every firm listed on TradesmanFinder"
        sub="Firms grouped by trade, with their photos, ratings and reviews. Listings marked “Example listing” are illustrative entries we use while the first firms complete vetting."
      />

      <Section>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border pb-6 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{realCount}</strong> vetted firms
          </span>
          <span>
            <strong className="text-foreground">{exampleCount}</strong> example
            listings
          </span>
          <span>
            <strong className="text-foreground">{groups.length}</strong> trades
            covered
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="py-12 text-muted-foreground">
            No firms are listed yet.{" "}
            <Link to="/claim" className="text-primary underline">
              Claim your listing
            </Link>{" "}
            to be one of the first.
          </p>
        ) : (
          <div className="mt-10 space-y-14">
            {groups.map(({ trade, firms }) => (
              <section key={trade.slug}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-xl">{trade.name}</h2>
                  <Link
                    to="/trades/$trade"
                    params={{ trade: trade.slug }}
                    className="text-sm text-primary underline"
                  >
                    Search {trade.name.toLowerCase()} →
                  </Link>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {trade.blurb}
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {firms.map((pro) => (
                    <ProCard key={pro.id} pro={pro} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
