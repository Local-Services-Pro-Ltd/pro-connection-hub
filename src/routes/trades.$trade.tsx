import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ProCard } from "@/components/pro-card";
import { PageHero, Section } from "@/components/layout-bits";
import { trades, pros } from "@/lib/site-data";

export const Route = createFileRoute("/trades/$trade")({
  validateSearch: (search: Record<string, unknown>) => ({
    area: typeof search.area === "string" ? search.area : undefined,
  }),
  loader: ({ params }) => {
    const trade = trades.find((t) => t.slug === params.trade);
    if (!trade) throw notFound();
    return { trade };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Trade not found | TradesmanFinder" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { trade } = loaderData;
    const title = `Find a local ${trade.name.toLowerCase()} | TradesmanFinder`;
    const description = `${trade.blurb} Compare vetted ${trade.name.toLowerCase()}s near you. Typical cost ${trade.typicalCost}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: TradePage,
});

function TradePage() {
  const { trade } = Route.useLoaderData();
  const { area } = Route.useSearch();
  const matches = pros.filter((p) => p.tradeSlug === trade.slug);
  const others = pros.filter((p) => p.tradeSlug !== trade.slug);

  return (
    <>
      <PageHero
        eyebrow={area ? `Near ${area}` : "Trade"}
        title={`${trade.name}s you can actually book.`}
        sub={trade.blurb}
      >
        <dl className="flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          <div>
            <dt className="eyebrow">Typical cost</dt>
            <dd className="mt-1 font-display text-xl">{trade.typicalCost}</dd>
          </div>
          <div>
            <dt className="eyebrow">Available now</dt>
            <dd className="mt-1 font-display text-xl text-primary">
              {trade.pros} pros
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Avg. response</dt>
            <dd className="mt-1 font-display text-xl">Under 2 hours</dd>
          </div>
        </dl>
      </PageHero>

      <Section>
        {matches.length > 0 ? (
          <>
            <p className="eyebrow">Top rated {trade.name.toLowerCase()}s</p>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {matches.map((p) => (
                <ProCard key={p.id} pro={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-border bg-card p-8">
            <h2 className="text-2xl">
              No {trade.name.toLowerCase()} profiles published yet
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              We have {trade.pros} vetted {trade.name.toLowerCase()}s on the
              network who take work by job post. Describe the job and they'll
              come to you.
            </p>
            <Link
              to="/post-job"
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Post this job — free
            </Link>
          </div>
        )}

        <div className="mt-16 border-t border-border pt-10">
          <p className="eyebrow">Also nearby</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <ProCard key={p.id} pro={p} />
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
