import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { PageHero, Section, SectionHead } from "@/components/layout-bits";
import { tradesQuery } from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { allCostGuides, gbp } from "@/lib/cost-guides";
import { tradeHero, tradeAlt, tradeFocal } from "@/lib/trade-media";

export const Route = createFileRoute("/costs/")({
  loader: async ({ context }) => {
    const [, origin] = await Promise.all([
      context.queryClient.ensureQueryData(tradesQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const base = loaderData?.origin ?? "";
    const title = "How much should it cost? UK trade price guides | TradesmanFinder";
    const description =
      "Real 2026 UK prices for plumbing, electrics, roofing, bathrooms, kitchens and more — with a free calculator that prices your job before you speak to anyone.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/costs` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(base
          ? [
              { property: "og:image", content: `${base}${tradeHero("plumber")}` },
              { name: "twitter:image", content: `${base}${tradeHero("plumber")}` },
            ]
          : []),
      ],
      ...(base ? { links: [{ rel: "canonical", href: `${base}/costs` }] } : {}),
    };
  },
  component: CostsIndex,
});

function CostsIndex() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const guides = allCostGuides();
  const nameOf = (slug: string) =>
    trades.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <>
      <PageHero
        eyebrow="Cost guides"
        title="Know the price before you pick up the phone"
        sub="Independent UK price ranges for the jobs people actually book, plus a calculator that prices your own job in about thirty seconds. No sign-up, no lead form."
      />

      <Section>
        <SectionHead
          eyebrow={`${guides.length} guides`}
          title="Pick a trade"
          sub="Every guide gives per-item prices, typical day rates, what pushes a quote up, and the questions worth asking before you agree anything."
        />

        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => {
            const name = nameOf(g.slug);
            const cheapest = Math.min(...g.jobs.map((j) => j.low));
            return (
              <Link
                key={g.slug}
                to="/costs/$trade"
                params={{ trade: g.slug }}
                className="group flex flex-col bg-card transition-colors hover:bg-surface"
              >
                <img
                  src={tradeHero(g.slug)}
                  alt={tradeAlt(g.slug, name)}
                  loading="lazy"
                  width={1600}
                  height={900}
                  style={{ objectPosition: tradeFocal(g.slug).focal }}
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl">{name} prices</h2>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {g.intro}
                  </p>
                  <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                    Day rate {gbp(g.dayRate[0])}–{gbp(g.dayRate[1])} · jobs from{" "}
                    {gbp(cheapest)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
          Prices are typical South East figures excluding VAT, updated for 2026.
          They are a guide to help you sanity-check a quote — the only real price
          is the one a tradesperson gives you after seeing the job.
        </p>
      </Section>
    </>
  );
}
