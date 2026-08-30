import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Section } from "@/components/layout-bits";
import { PageHero } from "@/components/layout-bits";
import { CostCalculator } from "@/components/cost-calculator";
import { supabase } from "@/integrations/supabase/client";
import { getRequestOrigin } from "@/lib/origin.functions";
import { costGuide, gbp } from "@/lib/cost-guides";
import { tradeHero, tradeAlt, tradeFocal } from "@/lib/trade-media";
import type { Trade } from "@/lib/queries";

export const Route = createFileRoute("/costs/$trade")({
  loader: async ({ params }) => {
    const guide = costGuide(params.trade);
    if (!guide) throw notFound();
    const [{ data }, origin] = await Promise.all([
      supabase.from("trades").select("*").eq("slug", params.trade).maybeSingle(),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return { guide, trade: data as Trade, origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Cost guide not found | TradesmanFinder" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { guide, trade, origin } = loaderData;
    const lowest = Math.min(...guide.jobs.map((j) => j.low));
    const title = `How much does a ${trade.name.toLowerCase()} cost in 2026? | TradesmanFinder`;
    const description = `Typical UK ${trade.name.toLowerCase()} prices: jobs from ${gbp(lowest)}, day rates ${gbp(guide.dayRate[0])}–${gbp(guide.dayRate[1])}. Use the free calculator to price your own job.`;
    const base = origin ?? "";
    const image = origin ? `${origin}/og/trade-${trade.slug}.jpg` : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${base}/costs/${trade.slug}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${base}/costs/${trade.slug}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: guide.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <Section>
      <h1 className="text-3xl">No cost guide for that trade yet</h1>
      <Link to="/costs" className="mt-4 inline-block text-primary hover:underline">
        See all cost guides
      </Link>
    </Section>
  ),
  component: CostGuidePage,
});

function CostGuidePage() {
  const { guide, trade } = Route.useLoaderData();
  const focal = tradeFocal(trade.slug);

  return (
    <>
      <PageHero
        eyebrow="Cost guide"
        title={`How much does a ${trade.name.toLowerCase()} cost?`}
        sub={guide.intro}
        image={tradeHero(trade.slug)}
        imageAlt={tradeAlt(trade.slug, trade.name)}
        focal={focal.focal}
        focalMobile={focal.focalMobile}
      >
        <dl className="flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          <div>
            <dt className="eyebrow">Typical day rate</dt>
            <dd className="mt-1 font-display text-xl">
              {gbp(guide.dayRate[0])}–{gbp(guide.dayRate[1])}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Smallest job</dt>
            <dd className="mt-1 font-display text-xl text-primary">
              from {gbp(Math.min(...guide.jobs.map((j) => j.low)))}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Priced jobs</dt>
            <dd className="mt-1 font-display text-xl">{guide.jobs.length}</dd>
          </div>
        </dl>
      </PageHero>

      <Section>
        <CostCalculator guide={guide} tradeName={trade.name} />

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl">What each job costs</h2>
            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">
                    Job
                  </th>
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">
                    Unit
                  </th>
                  <th scope="col" className="py-3 text-right font-display font-semibold">
                    Typical price
                  </th>
                </tr>
              </thead>
              <tbody>
                {guide.jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border align-top">
                    <td className="py-3 pr-4">
                      {j.label}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {j.note}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">per {j.unit}</td>
                    <td className="whitespace-nowrap py-3 text-right">
                      {gbp(j.low)}–{gbp(j.high)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted-foreground">
              Ex VAT. South East baseline — the calculator adjusts for your region.
            </p>
          </div>

          <div>
            <h2 className="text-2xl">Keeping the cost down</h2>
            <ul className="mt-5 space-y-3">
              {guide.tips.map((tip) => (
                <li
                  key={tip}
                  className="rounded-sm border border-border bg-card p-4 text-sm leading-relaxed"
                >
                  {tip}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl">Common questions</h2>
            <dl className="mt-5 space-y-5">
              {guide.faqs.map((f) => (
                <div key={f.q} className="border-b border-border pb-5">
                  <dt className="font-display font-semibold">{f.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl">Ready for real numbers?</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Describe the job once and vetted {trade.name.toLowerCase()}s come
              back to you with priced quotes. Free, and no obligation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/post-job"
              search={{ trade: trade.slug }}
              className="rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Post this job — free
            </Link>
            <Link
              to="/trades/$trade"
              params={{ trade: trade.slug }}
              search={{}}
              className="rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Browse {trade.name.toLowerCase()}s
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
