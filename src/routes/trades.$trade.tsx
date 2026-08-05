import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ProCard } from "@/components/pro-card";
import { PageHero, Section } from "@/components/layout-bits";
import { ProFiltersBar } from "@/components/pro-filters";
import {
  tradesQuery,
  prosQuery,
  availabilityLabels,
  type Trade,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

type Search = {
  area?: string;
  budget?: string;
  availability?: string;
  q?: string;
  sort?: string;
};

const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export const Route = createFileRoute("/trades/$trade")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(str(search["area"]) ? { area: str(search["area"])! } : {}),
    ...(str(search["budget"]) ? { budget: str(search["budget"])! } : {}),
    ...(str(search["availability"])
      ? { availability: str(search["availability"])! }
      : {}),
    ...(str(search["q"]) ? { q: str(search["q"])! } : {}),
    ...(str(search["sort"]) ? { sort: str(search["sort"])! } : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps, context }) => {
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("slug", params.trade)
      .maybeSingle();
    if (!data) throw notFound();
    await Promise.all([
      context.queryClient.ensureQueryData(
        prosQuery({ trade: params.trade, ...deps }),
      ),
      context.queryClient.ensureQueryData(tradesQuery),
    ]);
    return { trade: data as Trade };
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
    const description = `${trade.blurb} Compare vetted ${trade.name.toLowerCase()}s near you. Typical cost ${trade.typical_cost}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
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
      <h1 className="text-3xl">That trade doesn't exist</h1>
      <Link to="/trades" className="mt-4 inline-block text-primary hover:underline">
        Browse all trades
      </Link>
    </Section>
  ),
  component: TradePage,
});

function TradePage() {
  const { trade } = Route.useLoaderData();
  const search = Route.useSearch();
  const { data: matches } = useSuspenseQuery(
    prosQuery({ trade: trade.slug, ...search }),
  );

  const available = matches.filter((p) => p.availability === "immediate").length;
  const avg = matches.length
    ? Math.round(
        matches.reduce((a, p) => a + p.response_mins, 0) / matches.length,
      )
    : 0;

  return (
    <>
      <PageHero
        eyebrow={search.area ? `Near ${search.area}` : "Trade"}
        title={`${trade.name}s you can actually book.`}
        sub={trade.blurb}
      >
        <dl className="flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          <div>
            <dt className="eyebrow">Typical cost</dt>
            <dd className="mt-1 font-display text-xl">{trade.typical_cost}</dd>
          </div>
          <div>
            <dt className="eyebrow">Free right now</dt>
            <dd className="mt-1 font-display text-xl text-primary">
              {available} pro{available === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Avg. response</dt>
            <dd className="mt-1 font-display text-xl">
              {avg ? `~${avg} min` : "—"}
            </dd>
          </div>
        </dl>
      </PageHero>

      <Section>
        <ProFiltersBar />

        <p className="mt-8 eyebrow">
          {matches.length} {trade.name.toLowerCase()}
          {matches.length === 1 ? "" : "s"} matching
        </p>

        {matches.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((p) => (
              <ProCard key={p.id} pro={p} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-border bg-card p-8">
            <h2 className="text-2xl">Nothing matches those filters</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Widen the area, budget or availability — or describe the job and
              let vetted {trade.name.toLowerCase()}s come to you.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/trades/$trade"
                params={{ trade: trade.slug }}
                search={{}}
                className="rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Clear filters
              </Link>
              <Link
                to="/post-job"
                search={{ trade: trade.slug }}
                className="inline-flex rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
              >
                Post this job — free
              </Link>
            </div>
          </div>
        )}

        <p className="mt-10 text-sm text-muted-foreground">
          Availability shown is what each firm last confirmed:{" "}
          {Object.values(availabilityLabels).join(", ").toLowerCase()}.
        </p>
      </Section>
    </>
  );
}
