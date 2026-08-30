import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";
import { WaitingListInline } from "@/components/waiting-list-inline";
import { Section, SectionHead } from "@/components/layout-bits";
import { LiveMapHero } from "@/components/live-map-hero";
import { areasQuery, proCountsQuery } from "@/lib/queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import street from "@/assets/street.jpg";

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
      "Where we're live — Greater London, Kent & Surrey | TradesmanFinder";
    const description =
      "TradesmanFinder is live across Greater London, Kent and Surrey, with more of the South East opening soon. Join the waiting list for your postcode.";
    const base = loaderData?.origin ?? "";
    const image = loaderData?.origin
      ? `${loaderData.origin}/og/areas.jpg`
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "Where we're live — TradesmanFinder",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/areas` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Where we're live — TradesmanFinder" },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: "Live map of the areas covered by vetted tradesmen",
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

  const live = areas.filter((a) => a.status === "live");
  const soon = areas.filter((a) => a.status !== "live");

  return (
    <>
      <LiveMapHero
        eyebrow="Live coverage"
        title="Local means local."
        sub="We've started in Greater London, Kent and Surrey — properly covered, rather than thinly spread across the whole country. Watch jobs and vans move across the network in real time."
      />

      <Section>
        <SectionHead
          eyebrow="Live now"
          title="Three areas, covered properly."
          sub="Every trade on the network works these postcodes for a living. No one is driving in from two counties away to quote."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {live.map((a) => (
            <Link
              key={a.slug}
              to="/trades/$trade"
              params={{ trade: "builder" }}
              search={{ area: a.slug }}
              className="group rounded-md border border-border bg-card p-8 transition-colors hover:border-primary"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-1 font-display text-[0.7rem] uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Live
              </span>
              <h2 className="mt-5 text-2xl">{a.name}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {a.note}
              </p>
              <p className="mt-8 flex items-center gap-2 font-display text-sm font-semibold text-primary">
                {counts.byArea[a.slug] ?? 0} vetted pros
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {soon.length > 0 && (
        <Section className="border-y border-border bg-surface">
          <SectionHead
            eyebrow="Opening next"
            title="Rolling out across the South East."
            sub="We open an area once enough vetted trades have signed up to answer the jobs in it. Add your postcode and you'll move it up the queue."
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {soon.map((a) => (
              <div key={a.slug} className="bg-card p-7">
                <MapPin
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-lg">{a.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.note}</p>
                <p className="mt-6 font-display text-xs uppercase tracking-widest text-muted-foreground">
                  Coming soon
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section className="border-t border-border">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <img
            src={street}
            alt="A UK terraced street at golden hour"
            loading="lazy"
            width={1600}
            height={900}
            className="rounded-md border border-border object-cover"
          />
          <div>
            <p className="eyebrow">Not on the list?</p>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
              Tell us where you are.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We'd rather say "not yet" than send you three trades who can't
              actually get to you. Leave your postcode and we'll email you the
              day we open — homeowners and trades both welcome.
            </p>
            <div className="mt-8">
              <WaitingListInline source="areas_page" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Already covered?{" "}
              <Link
                to="/post-job"
                search={{}}
                className="font-medium text-primary underline underline-offset-2"
              >
                Post a job
              </Link>{" "}
              or{" "}
              <Link
                to="/coverage"
                className="font-medium text-primary underline underline-offset-2"
              >
                track which area opens next
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
