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
    const title = "How trade onboarding and checks work | TradesmanFinder";
    const description =
      "See the ID, insurance and trade credential checks local firms must complete before they can quote through TradesmanFinder.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "How trade checks work — TradesmanFinder",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/verification` },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "How trade checks work — TradesmanFinder",
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
                  text: "During onboarding we ask for photo ID, company details, public liability insurance and any required trade credentials. These checks must be completed before a firm can quote.",
                },
              },
              {
                "@type": "Question",
                name: "What does vetting in progress mean?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The firm is listed while onboarding continues. It must complete its ID and insurance checks before it can quote.",
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
    body: "Before a firm can quote, we check photo ID against its company or sole-trader details and check the Companies House record where applicable.",
  },
  {
    icon: ShieldCheck,
    title: "Insurance",
    body: "Before a firm can quote, we check its public liability insurance certificate and expiry date.",
  },
  {
    icon: FileCheck2,
    title: "Trade credentials",
    body: "Before a firm can quote for work requiring registration, we check the relevant scheme details and evidence.",
  },
  {
    icon: Star,
    title: "Reviews",
    body: "Reviews will only come from customers who've had work done through TradesmanFinder, and are moderated before publishing.",
  },
  {
    icon: RefreshCw,
    title: "Ongoing monitoring",
    body: "Firms must keep their ID, insurance and credential details current to remain approved to quote.",
  },
];

function Verification() {
  return (
    <>
      <Section>
        <SectionHead
          eyebrow="Verification"
          title="What vetting in progress means."
          sub="We're onboarding local trades now. Listed firms must complete their ID and insurance checks before they can quote."
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
          title="Apply to complete your checks."
          sub="Send us your ID, insurance and any required trade credentials. Your profile shows vetting in progress until the checks are complete."
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
