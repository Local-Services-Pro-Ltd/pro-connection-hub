import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHero, Section, SectionHead } from "@/components/layout-bits";
import { areasQuery, proCountsQuery } from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import street from "@/assets/street.jpg";
import heroAreas from "@/assets/hero-areas.jpg";

export const Route = createFileRoute("/areas")({
  loader: async ({ context }) => {
    const [, , origin] = await Promise.all([
      context.queryClient.ensureQueryData(areasQuery),
      context.queryClient.ensureQueryData(proCountsQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const title =
      "Areas we cover — local tradesmen across the UK | TradesmanFinder";
    const description =
      "Vetted tradesmen in London, Manchester, Birmingham, Bristol, Leeds, Glasgow, Cardiff and Newcastle — plus nationwide coverage by postcode.";
    const base = loaderData?.origin ?? "";
    const image = loaderData?.origin
      ? `${loaderData.origin}/og/areas.jpg`
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: "Areas we cover — TradesmanFinder" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/areas` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Areas we cover — TradesmanFinder" },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: "UK terraced streets from above at golden hour",
              },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${base}/areas` }],
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
      <p className="text-muted-foreground">No areas found.</p>
    </Section>
  ),
  component: Areas,
});

function Areas() {
  const { data: areas } = useSuspenseQuery(areasQuery);
  const { data: counts } = useSuspenseQuery(proCountsQuery);

  return (
    <>
      <PageHero
        eyebrow="Coverage"
        title="Local means local."
        sub="Trades are matched by the postcodes they actually work in — not by how far they're willing to drive for a lead."
        image={heroAreas}
        imageAlt="A misty UK city skyline of terraced streets at golden hour"
        focal="50% 55%"
        focalMobile="55% 60%"
      />


      <Section>
        <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((a) => (
            <Link
              key={a.slug}
              to="/trades/$trade"
              params={{ trade: "builder" }}
              search={{ area: a.slug }}
              className="bg-card p-7 transition-colors hover:bg-surface"
            >
              <h2 className="text-xl">{a.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{a.note}</p>
              <p className="mt-6 font-display text-xs uppercase tracking-widest text-primary">
                {counts.byArea[a.slug] ?? 0} vetted pros
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border bg-surface">
        <SectionHead
          eyebrow="Not on the list?"
          title="We cover the rest of the country too."
          sub="Post your job with a postcode and we'll match trades who work that area. If nobody suitable is available, we'll tell you straight away rather than sit on it."
        />
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          <img
            src={street}
            alt="A UK terraced street at golden hour"
            loading="lazy"
            width={1600}
            height={900}
            className="rounded-md border border-border object-cover"
          />
          <div>
            <Link
              to="/post-job"
              search={{}}
              className="inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Check my postcode
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
