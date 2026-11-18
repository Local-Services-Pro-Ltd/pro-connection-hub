import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageBanner } from "@/components/page-banner";
import { ProCard } from "@/components/pro-card";
import { Section, SectionHead } from "@/components/layout-bits";
import { costGuide, gbp, hasCostGuide } from "@/lib/cost-guides";
import { regionalJobRange } from "@/lib/area-pages";
import { areasQuery, prosQuery, tradesQuery } from "@/lib/queries";
import { breadcrumbSchema, ldScript, SITE_URL } from "@/lib/structured-data";

export const Route = createFileRoute("/areas_/$area_/$trade")({
  loader: async ({ params, context }) => {
    const [areas, trades] = await Promise.all([
      context.queryClient.ensureQueryData(areasQuery),
      context.queryClient.ensureQueryData(tradesQuery),
    ]);
    const area = areas.find((item) => item.slug === params.area);
    const trade = trades.find((item) => item.slug === params.trade);
    if (!area || !trade) throw notFound();
    if (area.status !== "live") {
      throw redirect({ to: "/areas/$area", params: { area: area.slug } });
    }
    const pros = await context.queryClient.ensureQueryData(
      prosQuery({ area: area.slug, trade: trade.slug }),
    );
    return {
      area,
      trade,
      firmCount: pros.filter((pro) => pro.area_slug === area.slug).length,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Area trade page unavailable | TradesmanFinder" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { area, trade, firmCount } = loaderData;
    const title = `${trade.name}s in ${area.name} | TradesmanFinder`;
    const description = `Find ${trade.name.toLowerCase()} firms in ${area.name}. See who is interested in your job and choose who to contact.`;
    const path = `/areas/${area.slug}/${trade.slug}`;
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
        ...(firmCount === 0 && !hasCostGuide(trade.slug)
          ? [{ name: "robots", content: "noindex" }]
          : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}${path}` }],
      scripts: [
        ldScript(
          breadcrumbSchema([
            { name: "Areas", path: "/areas" },
            { name: area.name, path: `/areas/${area.slug}` },
            { name: trade.name, path },
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
      <h1 className="text-3xl">That area or trade doesn't exist</h1>
      <Link to="/areas" className="mt-4 inline-block text-primary underline">
        Browse all areas
      </Link>
    </Section>
  ),
  component: AreaTradePage,
});

function AreaTradePage() {
  const { area, trade } = Route.useLoaderData();
  const matches = useSuspenseQuery(prosQuery({ area: area.slug, trade: trade.slug }));
  const firms = matches.data.filter((pro) => pro.area_slug === area.slug);
  const guide = hasCostGuide(trade.slug) ? costGuide(trade.slug) : undefined;

  return (
    <>
      <PageBanner
        eyebrow={area.name}
        title={`${trade.name}s in ${area.name}`}
        sub={trade.blurb}
        image={`/images/trades/${trade.slug}.webp`}
        imageAlt={`${trade.name} at work in ${area.name}`}
      />

      <Section>
        <SectionHead eyebrow="Local directory" title={`${trade.name} firms in ${area.name}`} />
        {firms.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {firms.map((pro) => (
              <ProCard key={pro.id} pro={pro} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-md border border-border bg-card p-6 text-muted-foreground">
            We're onboarding {trade.name} firms in {area.name}. Post your job and we'll show you
            firms as they join.
          </p>
        )}
      </Section>

      {guide && (
        <Section className="border-y border-border bg-surface">
          <SectionHead
            eyebrow="Cost guide"
            title={`Typical ${area.name} prices from our cost guide — your quote may differ`}
          />
          <div className="mt-8 overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-4 font-display">
                    Typical job
                  </th>
                  <th scope="col" className="p-4 text-right font-display">
                    Adjusted range
                  </th>
                </tr>
              </thead>
              <tbody>
                {guide.jobs.map((job) => {
                  const [low, high] = regionalJobRange(area.slug, job.low, job.high);
                  return (
                    <tr key={job.id} className="border-b border-border last:border-0">
                      <td className="p-4">
                        {job.label}
                        <span className="block text-xs text-muted-foreground">per {job.unit}</span>
                      </td>
                      <td className="whitespace-nowrap p-4 text-right">
                        {gbp(low)}–{gbp(high)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Link
            to="/costs/$trade"
            params={{ trade: trade.slug }}
            className="mt-5 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            See the full {trade.name.toLowerCase()} cost guide
          </Link>
        </Section>
      )}

      <Section>
        <SectionHead eyebrow="How it works here" title="You choose who to contact." />
        <ol className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
          <li className="bg-card p-6 text-sm text-muted-foreground">
            <strong className="mb-2 block text-foreground">1. Post your job</strong>
            We show your job to local firms in your trade and area, and match you with up to three
            of them.
          </li>
          <li className="bg-card p-6 text-sm text-muted-foreground">
            <strong className="mb-2 block text-foreground">2. Review interest</strong>
            Firms can say they're interested. You see who they are, read their profiles and choose
            who to contact. Nobody gets your details until you do.
          </li>
          <li className="bg-card p-6 text-sm text-muted-foreground">
            <strong className="mb-2 block text-foreground">3. Stay in control</strong>
            Only the firms you contact can reply. No fee, no obligation.
          </li>
        </ol>
        <Link
          to="/post-job"
          search={{ trade: trade.slug }}
          className="mt-8 inline-block rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember"
        >
          Post a {trade.name} job in {area.name}
        </Link>
      </Section>
    </>
  );
}
