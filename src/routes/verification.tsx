import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, FileCheck2, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import {
  breadcrumbSchema,
  ldScript,
  organizationSchema,
} from "@/lib/structured-data";


const SITE = "https://tradesmanfinder.org";

export const Route = createFileRoute("/verification")({
  head: () => {
    const title =
      "How we verify tradesmen — checks behind every badge | TradesmanFinder";
    const description =
      "ID, insurance, trade credentials and review checks: exactly what we verify before a tradesman gets a TradesmanFinder badge, and what each badge means.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "How we verify tradesmen — TradesmanFinder",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/verification` },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "How we verify tradesmen — TradesmanFinder",
        },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: `${SITE}/verification` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How does TradesmanFinder verify tradesmen?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "We check photo ID against company records, confirm public liability insurance is current, verify trade credentials with the issuing body, and only publish reviews tied to a real account.",
                },
              },
              {
                "@type": "Question",
                name: "What does a verified badge mean?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Each badge maps to one specific check we completed and dated. A badge disappears automatically when the underlying document expires.",
                },
              },
            ],
          }),
        },
        ldScript(organizationSchema()),
        ldScript(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "How we verify", path: "/verification" },
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
      <p className="text-muted-foreground">Not found.</p>
    </Section>
  ),
  component: Verification,
});

const checks = [
  {
    icon: BadgeCheck,
    title: "Identity",
    body: "Photo ID matched against the company record at Companies House or the sole-trader details given on application. No anonymous profiles.",
  },
  {
    icon: ShieldCheck,
    title: "Insurance",
    body: "Public liability cover is checked against the certificate and the expiry date is stored. The badge drops off the profile the day cover lapses.",
  },
  {
    icon: FileCheck2,
    title: "Trade credentials",
    body: "Gas Safe, NICEIC, NAPIT, FENSA and similar registrations are confirmed with the issuing body using the registration number — not a photo of a card.",
  },
  {
    icon: Star,
    title: "Reviews",
    body: "Reviews are tied to a signed-in account and a real job. We publish the bad ones too — a profile with nothing but five stars tells you nothing.",
  },
  {
    icon: RefreshCw,
    title: "Ongoing monitoring",
    body: "Checks aren't a one-off. Every credential carries an expiry we watch, complaints are reviewed as they come in, and a firm that stops meeting the standard loses its badges — whatever it pays us.",
  },
];

function Verification() {
  return (
    <>
      <Section>
        <SectionHead
          eyebrow="Verification"
          title="What the badges actually mean."
          sub="Plenty of directories call a trade 'verified' because they paid to join. Ours means something specific was checked, by us, on a date we can show you."
        />

        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {checks.map((c) => (
            <div key={c.title} className="bg-card p-8">
              <c.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-xl">{c.title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border bg-surface">
        <SectionHead
          eyebrow="For tradesmen"
          title="Getting verified takes about a day."
          sub="Send us the documents once. We check them, date them, and set a reminder before anything expires so your badges never quietly disappear."
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/claim"
            search={{}}
            className="inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Apply to be checked
          </Link>
          <Link
            to="/for-tradesmen"
            hash="verification"
            className="inline-flex rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
          >
            Join as a tradesman
          </Link>
          <Link
            to="/post-job"
            search={{}}
            className="inline-flex rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
          >
            Post a job instead
          </Link>
        </div>
      </Section>
    </>
  );
}
