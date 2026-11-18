import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageBanner } from "@/components/page-banner";
import { ProCard } from "@/components/pro-card";
import { Section, SectionHead } from "@/components/layout-bits";
import { WaitingListInline } from "@/components/waiting-list-inline";
import { areasQuery, prosQuery, tradesQuery } from "@/lib/queries";
import { AREA_POSTCODE_PREFIXES, type LiveArea } from "@/lib/postcode-gate";
import { breadcrumbSchema, ldScript, SITE_URL } from "@/lib/structured-data";

export const Route = createFileRoute("/areas_/$area")({
  loader: async ({ params, context }) => {
    const [areas, trades] = await Promise.all([
      context.queryClient.ensureQueryData(areasQuery),
      context.queryClient.ensureQueryData(tradesQuery),
    ]);
    const area = areas.find((item) => item.slug === params.area);
    if (!area) throw notFound();
    const pros =
      area.status === "live"
        ? await context.queryClient.ensureQueryData(prosQuery({ area: area.slug }))
        : [];
    return {
      area,
      trades,
      firmCount: pros.filter((pro) => pro.area_slug === area.slug).length,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Area not found | TradesmanFinder" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { area } = loaderData;
    const live = area.status === "live";
    const pageTitle = live ? `Trades in ${area.name}` : `${area.name}: coming soon`;
    const title = `${pageTitle} | TradesmanFinder`;
    const description = live
      ? `Find local trades in ${area.name}, see interested firms and choose who to contact. Post a job free with TradesmanFinder.`
      : `${area.name} is coming soon to TradesmanFinder. Join the waiting list for local trade and homeowner updates.`;
    const path = `/areas/${area.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE_URL}${path}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(!live ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}${path}` }],
      scripts: [
        ldScript(
          breadcrumbSchema([
            { name: "Areas", path: "/areas" },
            { name: area.name, path },
          ]),
        ),
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
      <h1 className="text-3xl">That area doesn't exist</h1>
      <Link to="/areas" className="mt-4 inline-block text-primary underline">
        Browse all areas
      </Link>
    </Section>
  ),
  component: AreaPage,
});

function AreaPage() {
  const { area } = Route.useLoaderData();
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const live = area.status === "live";
  const matches = useSuspenseQuery(prosQuery({ area: area.slug }));
  const firms = live ? matches.data.filter((pro) => pro.area_slug === area.slug) : [];
  const prefixes = AREA_POSTCODE_PREFIXES[area.slug as LiveArea] ?? [];
  const path = `/areas/${area.slug}`;

  return (
    <>
      <PageBanner
        eyebrow={live ? "Local trades" : "Area onboarding"}
        title={live ? `Trades in ${area.name}` : `${area.name}: coming soon`}
        sub={
          live
            ? `We're onboarding local trades across ${area.name}. Post your job, see local firms and choose who to contact.`
            : area.note
        }
        image="/images/pages/areas.webp"
        imageAlt={`Homes and local streets in ${area.name}`}
      />

      {live ? (
        <>
          <Section>
            {prefixes.length > 0 && (
              <p className="mb-8 text-sm text-muted-foreground">
                Covering {prefixes.join(", ")} postcodes
              </p>
            )}
            <SectionHead eyebrow="All trades" title={`Find your trade in ${area.name}.`} />
            <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {trades.map((trade) => (
                <Link
                  key={trade.slug}
                  to="/areas/$area/$trade"
                  params={{ area: area.slug, trade: trade.slug }}
                  className="group bg-card p-6 transition-colors hover:bg-surface"
                >
                  <h2 className="font-display text-lg group-hover:text-primary">{trade.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{trade.blurb}</p>
                </Link>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/post-job"
                search={{}}
                className="rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember"
              >
                Post a job
              </Link>
              <Link
                to="/join"
                className="rounded-sm border border-border-strong px-6 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Join as a trade
              </Link>
            </div>
          </Section>

          <Section className="border-t border-border bg-surface">
            <SectionHead eyebrow="Local directory" title={`Firms in ${area.name}`} />
            {firms.length > 0 ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {firms.map((pro) => (
                  <ProCard key={pro.id} pro={pro} />
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
                We're onboarding firms in {area.name}. Post your job and we'll show you firms as
                they join.
              </p>
            )}
          </Section>
        </>
      ) : (
        <Section>
          <div className="max-w-2xl rounded-md border border-border bg-card p-8">
            <h2 className="text-2xl">Tell us where you are.</h2>
            <p className="mt-3 text-muted-foreground">
              Join the waiting list and we'll email you when {area.name} opens.
            </p>
            <div className="mt-6">
              <WaitingListInline source={`area_${area.slug}`} />
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
