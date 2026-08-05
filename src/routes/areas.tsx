import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero, Section, SectionHead } from "@/components/layout-bits";
import { areas } from "@/lib/site-data";
import street from "@/assets/street.jpg";

export const Route = createFileRoute("/areas")({
  head: () => ({
    meta: [
      { title: "Areas we cover — local tradesmen across the UK | TradesmanFinder" },
      {
        name: "description",
        content:
          "Vetted tradesmen in London, Manchester, Birmingham, Bristol, Leeds, Glasgow, Cardiff and Newcastle — plus nationwide coverage by postcode.",
      },
      { property: "og:title", content: "Areas we cover — TradesmanFinder" },
      {
        property: "og:description",
        content: "Vetted local trades across every UK region.",
      },
    ],
  }),
  component: Areas,
});

function Areas() {
  return (
    <>
      <PageHero
        eyebrow="Coverage"
        title="Local means local."
        sub="Trades are matched by the postcodes they actually work in — not by how far they're willing to drive for a lead."
      />

      <Section>
        <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((a) => (
            <div key={a.slug} className="bg-card p-7">
              <h2 className="text-xl">{a.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{a.note}</p>
              <p className="mt-6 font-display text-xs uppercase tracking-widest text-primary">
                {a.pros} vetted pros
              </p>
            </div>
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
