import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { tradePlural } from "@/lib/trade-plural";
import { useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { WaitingListInline } from "@/components/waiting-list-inline";
import { ProCard } from "@/components/pro-card";
import { PageHero, Section } from "@/components/layout-bits";
import { ProFiltersBar } from "@/components/pro-filters";
import { SaveSearchButton } from "@/components/save-search-button";
import { ProjectGallery } from "@/components/project-gallery";
import {
  tradesQuery,
  prosQuery,
  fetchTradeHeroImage,
  tradeProjectsQuery,
  type Trade,
  type TradeHeroImage,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { hasCostGuide } from "@/lib/cost-guides";
import { tradeFocal, hasTradeOgImage } from "@/lib/trade-media";
import { tradeHeroCopy } from "@/lib/trade-copy";
import { getRequestOrigin } from "@/lib/origin.functions";

type Search = {
  area?: string;
  budget?: string;
  availability?: string;
  q?: string;
  sort?: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export const Route = createFileRoute("/trades/$trade")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(str(search["area"]) ? { area: str(search["area"])! } : {}),
    ...(str(search["budget"]) ? { budget: str(search["budget"])! } : {}),
    ...(str(search["availability"]) ? { availability: str(search["availability"])! } : {}),
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
    const [, , origin, heroOverride] = await Promise.all([
      context.queryClient.ensureQueryData(prosQuery({ trade: params.trade, ...deps })),
      context.queryClient.ensureQueryData(tradesQuery),
      getRequestOrigin(),
      fetchTradeHeroImage(params.trade),
    ]);
    return {
      trade: data as Trade,
      origin,
      heroOverride: heroOverride as TradeHeroImage | null,
    };
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
    const { trade, origin } = loaderData;
    const title = `Find a local ${trade.name.toLowerCase()} | TradesmanFinder`;
    const description = `${trade.blurb} Browse local ${trade.name.toLowerCase()}s joining TradesmanFinder. Typical cost ${trade.typical_cost}.`;
    const base = origin ?? "";
    const image =
      origin && hasTradeOgImage(trade.slug) ? `${origin}/og/trade-${trade.slug}.jpg` : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/trades/${trade.slug}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: `A professional ${trade.name.toLowerCase()} at work on a UK job`,
              },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${base}/trades/${trade.slug}` }],
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
  const { trade, heroOverride } = Route.useLoaderData();
  const search = Route.useSearch();
  const { data: matches } = useSuspenseQuery(prosQuery({ trade: trade.slug, ...search }));
  const { data: tradeProjects } = useQuery(tradeProjectsQuery(trade.slug));
  const [failedHeroImage, setFailedHeroImage] = useState<string | null>(null);

  const copy = tradeHeroCopy(trade.slug, {
    trade: trade.name,
    tradePlural: tradePlural(trade.name),
    blurb: trade.blurb,
    ...(search.area ? { area: search.area } : {}),
  });

  // Admin overrides win; otherwise try the public local trade photo, then no image.
  const requestedHeroImage = heroOverride?.image_url || `/images/trades/${trade.slug}.webp`;
  const heroImage = failedHeroImage === requestedHeroImage ? undefined : requestedHeroImage;
  const heroAlt = heroOverride?.alt_text?.trim() || `${trade.name} at work`;
  const base = tradeFocal(trade.slug);
  const focal = {
    focal: heroOverride?.focal || base.focal,
    focalMobile: heroOverride?.focal_mobile || base.focalMobile,
  };

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        sub={copy.sub}
        {...(heroImage ? { image: heroImage } : {})}
        imageAlt={heroAlt}
        focal={focal.focal}
        focalMobile={focal.focalMobile}
        onImageError={() => setFailedHeroImage(requestedHeroImage)}
      >
        <dl className="flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          <div>
            <dt className="eyebrow">{copy.stats.cost}</dt>
            <dd className="mt-1 font-display text-xl">{trade.typical_cost}</dd>
            {hasCostGuide(trade.slug) && (
              <dd className="mt-1">
                <Link
                  to="/costs/$trade"
                  params={{ trade: trade.slug }}
                  className="text-sm text-primary hover:underline"
                >
                  Price your job →
                </Link>
              </dd>
            )}
          </div>
          <div>
            <dt className="eyebrow">Directory status</dt>
            <dd className="mt-1 font-display text-xl text-primary">Vetting in progress</dd>
          </div>
        </dl>
      </PageHero>

      <Section>
        {(tradeProjects ?? []).length > 0 && (
          <div className="mb-12">
            <ProjectGallery
              projects={tradeProjects ?? []}
              heading={`${trade.name} projects — before & after`}
            />
          </div>
        )}

        <ProFiltersBar />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="eyebrow">Firms in this trade</p>
          <SaveSearchButton
            label={`${trade.name}${search.area ? ` in ${search.area}` : ""}`}
            tradeSlug={trade.slug}
            area={search.area}
            filters={search as Record<string, unknown>}
          />
        </div>

        {matches.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((p) => (
              <ProCard key={p.id} pro={p} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-border bg-card p-8">
            <h2 className="text-2xl">
              {search.area || search.budget || search.availability || search.q
                ? "Nothing matches those filters"
                : "We're onboarding firms in this area"}
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              {search.area || search.budget || search.availability || search.q
                ? "Widen the area or budget, or post your job and we'll match you as soon as a firm is approved."
                : "We're onboarding firms in this area — post your job and we'll match you as soon as one is approved."}
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
          Every listed firm is marked vetting in progress until its ID and insurance checks are
          complete.
        </p>

        <div className="mt-12 grid gap-8 border-t border-border pt-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Outside our onboarding areas?</p>
            <h2 className="mt-3 text-2xl leading-tight sm:text-3xl">
              Tell us where you need a {trade.name.toLowerCase()}.
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Leave your postcode and we'll email you when an approved {trade.name.toLowerCase()}{" "}
              joins your area — you can{" "}
              <Link
                to="/coverage"
                className="font-medium text-primary underline underline-offset-2"
              >
                watch your area's progress
              </Link>{" "}
              in the meantime.
            </p>
          </div>
          <WaitingListInline source="trade_page" defaultTrade={trade.name} compact />
        </div>
      </Section>
    </>
  );
}
