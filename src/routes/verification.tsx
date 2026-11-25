import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Building2, FileCheck2, Images, ShieldCheck, Star } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { breadcrumbSchema, ldScript, organizationSchema } from "@/lib/structured-data";

const SITE = "https://tradesmanfinder.org";

export const Route = createFileRoute("/verification")({
  head: () => {
    const title = "How we check firms | TradesmanFinder";
    const description =
      "What TradesmanFinder checks before a firm can quote: ID, Companies House, insurance expiry, trade registrations and photos of past work, and what each profile label means.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "How we check firms — TradesmanFinder",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/verification` },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "How we check firms — TradesmanFinder",
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
                  text: "During onboarding we ask for photo ID, business details, public liability insurance and any trade registrations. We look limited companies up on the Companies House register, record insurance expiry dates and check trade registrations against each scheme's own register. ID and insurance checks must be completed before a firm can quote.",
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
            { name: "How we check firms", path: "/verification" },
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
    title: "Identity and business details",
    body: "A firm applying to join sends us photo ID and its business details. A person at TradesmanFinder reviews them, and can ask the firm for more before deciding.",
  },
  {
    icon: Building2,
    title: "Companies House",
    body: "For a limited company, we look the company number up on the Companies House register and confirm the company is active. We repeat that check every night for published firms. If a company stops being active, its check is removed until we have looked into it.",
  },
  {
    icon: ShieldCheck,
    title: "Public liability insurance",
    body: "We ask for the insurance certificate and record its expiry date, which is shown on the firm's profile. Once a policy passes its expiry date, the check automatically shows as expired until the firm sends us the renewal.",
  },
  {
    icon: FileCheck2,
    title: "Trade registrations",
    body: "Where a firm gives us a Gas Safe, NICEIC, NAPIT or FENSA registration, we check it against that scheme's own register. The profile links to the register so you can look the firm up yourself.",
  },
  {
    icon: Images,
    title: "Photos of past work",
    body: "Every job a firm adds to its work gallery is reviewed by us before it appears. If the firm changes the photos or the description, the job is hidden again until we have reviewed the change.",
  },
  {
    icon: Star,
    title: "Reviews",
    body: "Reviews will only come from customers who've had work done through TradesmanFinder, and are moderated before publishing.",
  },
];

const labels = [
  {
    label: "Vetting in progress",
    meaning:
      "The firm is listed, but we have not finished its checks. It must complete its ID and insurance checks before it can quote.",
  },
  {
    label: "Checked on a date",
    meaning:
      "We checked that item on the date shown. For registers that are open to the public, the profile gives you a link to check it yourself.",
  },
  {
    label: "Expired, awaiting renewal",
    meaning:
      "The item was checked but has passed its expiry date. We don't count it as checked until the firm sends us the renewal.",
  },
  {
    label: "No credentials uploaded yet",
    meaning: "We have not recorded any checks for this firm so far.",
  },
];

function Verification() {
  return (
    <>
      <Section>
        <SectionHead
          eyebrow="How we check firms"
          title="What we check, and what the labels mean."
          sub="We're onboarding local trades now. This page sets out exactly what we check, how often, and what you will see on a firm's profile."
        />

        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {checks.map((c) => (
            <div key={c.title} className="bg-card p-8">
              <c.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-xl">{c.title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border">
        <SectionHead
          eyebrow="On a firm's profile"
          title="What you will see."
          sub="Each profile has a Checks & credentials section. These are the labels it uses."
        />
        <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {labels.map((item) => (
            <div key={item.label} className="bg-card p-6">
              <dt className="font-display text-lg">{item.label}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section className="border-t border-border">
        <SectionHead
          eyebrow="Good to know"
          title="What our checks don't cover."
          sub="Our checks confirm what a firm has told us against official records and the documents it has sent. They are not a guarantee of the quality of any job, and we are not a party to the agreement between you and the firm you hire."
        />
        <ul className="mt-6 grid max-w-3xl gap-3 text-muted-foreground">
          <li>Ask for a written quote before work starts, and compare more than one.</li>
          <li>
            For gas work, check the engineer's Gas Safe ID card on the day. For electrical work, ask
            which scheme will certify it.
          </li>
          <li>
            If something on a profile looks wrong, tell us at{" "}
            <a href="mailto:hello@tradesmanfinder.org" className="text-primary hover:underline">
              hello@tradesmanfinder.org
            </a>{" "}
            and we will look into it.
          </li>
        </ul>
      </Section>

      <Section className="border-t border-border bg-surface">
        <SectionHead
          eyebrow="For tradesmen"
          title="Apply to complete your checks."
          sub="Send us your ID, insurance and any required trade credentials. Your profile shows vetting in progress until the checks are complete."
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/join"
            className="inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Apply to be checked
          </Link>
          <Link
            to="/join"
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
