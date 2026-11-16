import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ClipboardList,
  FileCheck2,
  Handshake,
  RefreshCw,
  Scale,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";

const SITE = "https://tradesmanfinder.org";

const faqs = [
  {
    q: "Is TradesmanFinder free for homeowners?",
    a: "Yes. Posting a job, comparing firms and reading reviews are free, and you're never obliged to hire anyone you're matched with.",
  },
  {
    q: "How many quotes will I get?",
    a: "Up to three matched firms per job, as local trades join and complete their checks. There's no obligation to hire anyone.",
  },
  {
    q: "Can a firm pay to be listed or featured?",
    a: "No. Firms can be listed while their checks are underway and are clearly tagged vetting in progress. ID and insurance checks must be completed before they can quote.",
  },
  {
    q: "What happens if a tradesman's insurance expires?",
    a: "We ask for insurance evidence and its expiry date during onboarding. A firm must keep its details current to remain approved to quote.",
  },
];

export const Route = createFileRoute("/how-it-works")({
  head: () => {
    const title = "How TradesmanFinder works — post, match, hire | TradesmanFinder";
    const description =
      "Post a job free and get matched with local trades as they join. Learn how onboarding, ID and insurance checks, matching and reviews work.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/how-it-works` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: `${SITE}/how-it-works` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
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
  component: HowItWorks,
});

const steps = [
  {
    n: "01",
    icon: ClipboardList,
    title: "Describe the job",
    body: "Two minutes, plain English, photos if you have them. Free, and you stay anonymous until you choose to share your details.",
  },
  {
    n: "02",
    icon: Handshake,
    title: "Get matched with up to three",
    body: "We match your job to local firms by trade and area as they join. Every firm must complete its ID and insurance checks before it can quote.",
  },
  {
    n: "03",
    icon: Scale,
    title: "Hire on the evidence",
    body: "Compare services, experience, vetting status and any published work. Reviews will only come from customers who've had work done through TradesmanFinder.",
  },
];

const criteria = [
  {
    icon: BadgeCheck,
    title: "Identity and company record",
    body: "Before a firm can quote, we check photo ID against its company or sole-trader details and check the Companies House record where applicable.",
  },
  {
    icon: ShieldCheck,
    title: "Public liability insurance",
    body: "Before a firm can quote, we check its public liability insurance certificate and expiry date.",
  },
  {
    icon: FileCheck2,
    title: "Trade accreditations",
    body: "Before a firm can quote for work requiring registration, we check the relevant scheme details and evidence.",
  },
  {
    icon: Star,
    title: "Review integrity",
    body: "Reviews will only come from customers who've had work done through TradesmanFinder, and are moderated before publishing.",
  },
  {
    icon: RefreshCw,
    title: "Ongoing monitoring",
    body: "Firms must keep their ID, insurance and credential details current to remain approved to quote.",
  },
];

function HowItWorks() {
  return (
    <>
      <Section>
        <SectionHead
          eyebrow="How it works"
          title="Three steps, no phone tag."
          sub="We're onboarding local trades now. Post your job and we'll match you as firms join and complete their checks."
        />

        <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="bg-card p-8">
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-display text-sm font-semibold tracking-widest text-muted-foreground">
                  {s.n}
                </span>
              </div>
              <h2 className="mt-4 text-xl">{s.title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/post-job"
            search={{}}
            className="inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Post a job — free
          </Link>
          <Link
            to="/trades"
            className="inline-flex rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
          >
            Browse trades instead
          </Link>
        </div>
      </Section>

      <Section className="border-t border-border bg-surface">
        <SectionHead
          eyebrow="Our standard"
          title="What we check before a firm can quote."
          sub="These are our onboarding requirements. Firms still undergoing checks are clearly marked vetting in progress."
        />
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {criteria.map((c) => (
            <div key={c.title} className="bg-card p-8">
              <c.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg">{c.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </div>
          ))}
        </div>
        <Link
          to="/verification"
          className="mt-8 inline-flex text-sm font-medium text-primary underline underline-offset-4"
        >
          The full verification detail
        </Link>
      </Section>

      <Section className="border-t border-border">
        <SectionHead eyebrow="Questions" title="The things people ask first." />
        <dl className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.q} className="bg-card p-8">
              <dt className="font-display text-lg">{f.q}</dt>
              <dd className="mt-3 leading-relaxed text-muted-foreground">
                {f.a}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/ask"
            search={{}}
            className="inline-flex rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
          >
            Ask the pros
          </Link>
          <Link
            to="/claim"
            search={{}}
            className="inline-flex rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
          >
            Apply as a firm
          </Link>
        </div>
      </Section>
    </>
  );
}
