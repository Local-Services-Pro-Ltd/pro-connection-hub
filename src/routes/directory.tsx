import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHero, Section } from "@/components/layout-bits";
import { ProCard } from "@/components/pro-card";
import { WaitingListInline } from "@/components/waiting-list-inline";
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
      { title: "Firm directory — local trades by trade | TradesmanFinder" },
      {
        name: "description",
        content:
          "Browse local firms joining TradesmanFinder. Firms must complete ID and insurance checks before they can quote.",
      },
      { property: "og:title", content: "Firm directory — TradesmanFinder" },
      {
        property: "og:description",
        content:
          "Local firms grouped by trade, with vetting status shown clearly on every profile.",
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

  return (
    <>
      <PageHero
        eyebrow="Directory"
        title="Firms onboarding now"
        sub="We're onboarding local trades now. Listed firms are marked vetting in progress until their ID and insurance checks are complete."
      />

      <Section>
        <p className="border-b border-border pb-6 text-sm text-muted-foreground">
          Firms must complete their ID and insurance checks before they can quote.
        </p>

        {groups.length === 0 ? (
          <div className="mt-10 rounded-md border border-border bg-card p-8">
            <h2 className="text-2xl">We're onboarding firms in this area</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              We're onboarding firms in this area — post your job and we'll match you as soon as one
              is approved.
            </p>
            <Link
              to="/post-job"
              search={{}}
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Post your job — free
            </Link>
            <div className="mt-8">
              <WaitingListInline source="directory_empty" />
            </div>
          </div>
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
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{trade.blurb}</p>
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
