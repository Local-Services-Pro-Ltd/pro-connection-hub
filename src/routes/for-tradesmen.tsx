import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, ShieldCheck, MapPin, Users, Star } from "lucide-react";
import { PageHero, Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { getRequestOrigin } from "@/lib/origin.functions";
import { plansQuery, planVisibilityQuery } from "@/lib/queries";
import { ONBOARDING_FREE } from "@/lib/onboarding";
import heroForTradesmen from "@/assets/hero-for-tradesmen.jpg";

export const Route = createFileRoute("/for-tradesmen")({
  loader: async ({ context }) => {
    const [, , origin] = await Promise.all([
      context.queryClient.ensureQueryData(plansQuery),
      context.queryClient.ensureQueryData(planVisibilityQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const title = ONBOARDING_FREE
      ? "Free for trades while we onboard | TradesmanFinder"
      : "Join as a tradesman — real leads, no lead fees | TradesmanFinder";
    const description = ONBOARDING_FREE
      ? "Free while we onboard trades — no card needed. Approved firms get Trade-tier features, with founding-firm discounts when charging starts."
      : "Get matched to homeowners in Greater London, Kent and Surrey. One flat monthly membership, no per-lead charges, no bidding wars.";
    const base = loaderData?.origin ?? "";
    const image = loaderData?.origin ? `${loaderData.origin}/og/for-tradesmen.jpg` : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: "Join TradesmanFinder as a trade" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${base}/for-tradesmen` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Join TradesmanFinder as a trade" },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              {
                property: "og:image:alt",
                content: "A tradesman beside his van at sunrise",
              },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${base}/for-tradesmen` }],
    };
  },
  component: ForTradesmen,
});

const perks = [
  {
    icon: Star,
    title: "No pay-per-lead",
    body: "Free while we onboard, with no card needed. After onboarding, one flat monthly fee — never a charge for a job you didn't win.",
  },
  {
    icon: Users,
    title: "Three quotes, not thirty",
    body: "Each job goes to a maximum of three trades. You're competing on merit, not on being first to dial.",
  },
  {
    icon: MapPin,
    title: "Your postcodes only",
    body: "You set the areas you genuinely cover. We don't send you a job ninety minutes down the motorway.",
  },
  {
    icon: ShieldCheck,
    title: "A clear public profile",
    body: "Your vetting status is shown plainly. Reviews will only come from customers who've had work done through TradesmanFinder.",
  },
];

const verificationSteps = [
  {
    title: "Identity",
    body: "We ask for photo ID and match it against the name on the account before approval.",
  },
  {
    title: "Public liability",
    body: "Upload your certificate so we can check the cover level and expiry date before approval.",
  },
  {
    title: "Trade credentials",
    body: "Where your trade requires registration, we ask for the relevant scheme details and evidence before approval.",
  },
  {
    title: "Company checks",
    body: "We ask for your Companies House number and trading address where you trade as a limited company.",
  },
];

/** Fallback when the visibility table is unreachable — Contractor stays hidden. */
const DEFAULT_VISIBILITY: Record<string, boolean> = {
  starter: true,
  trade: true,
  contractor: false,
};

function ForTradesmen() {
  const { user } = useAuth();
  const { data: allTiers } = useSuspenseQuery(plansQuery);
  const { data: visibility } = useSuspenseQuery(planVisibilityQuery);

  // Display-only filter. Hidden tiers stay in the database and remain
  // reachable via /signin?plan=<slug> so existing links keep working.
  const tiers = ONBOARDING_FREE
    ? allTiers
    : allTiers.filter((t) => {
        const flag = visibility[t.slug];
        if (typeof flag === "boolean") return flag;
        // Hidden tiers are not returned to visitors at all.
        if (Object.keys(visibility).length > 0) return false;
        return DEFAULT_VISIBILITY[t.slug] ?? t.visible;
      });

  return (
    <>
      <PageHero
        eyebrow="For tradesmen"
        title={
          ONBOARDING_FREE
            ? "Free while we onboard trades — no card needed."
            : "Leads that are worth answering."
        }
        sub={
          ONBOARDING_FREE
            ? "Approved firms get Trade-tier features free during onboarding, with a cap of three quotes per job and no per-lead charges. A real person replies to every application within 2 working days."
            : "A flat monthly membership and a cap of three quotes per job. We're onboarding local trades now, with ID and insurance checks required before quoting. A real person replies to every application within 2 working days."
        }
        image={heroForTradesmen}
        imageAlt="A tradesman checking his phone beside his van at sunrise"
        focal="55% 40%"
        focalMobile="65% 42%"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            to="/join"
            className="inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Apply to join
          </Link>
          <a
            href="#pricing"
            className="inline-flex rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
          >
            See membership
          </a>
        </div>
      </PageHero>

      <Section>
        <SectionHead eyebrow="Why bother" title="Built by people sick of lead fees." />
        <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {perks.map((p) => (
            <div key={p.title} className="bg-card p-8">
              <p.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-xl">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="verification" className="border-y border-border bg-surface">
        <SectionHead
          eyebrow="Verification"
          title="Checks before you can quote."
          sub="We're onboarding firms now. Your profile shows vetting in progress until the required ID and insurance checks are complete."
        />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {verificationSteps.map((s, i) => (
            <li key={s.title} className="rounded-md border border-border bg-card p-7">
              <span className="font-display text-xs uppercase tracking-widest text-primary">
                Step {i + 1}
              </span>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="pricing">
        <SectionHead
          eyebrow={ONBOARDING_FREE ? "Prices after onboarding" : "Membership"}
          title={ONBOARDING_FREE ? "Free now. Clear prices later." : "One price. Cancel any month."}
          sub={
            ONBOARDING_FREE
              ? "Every approved firm gets Trade-tier features free during onboarding. These are the monthly prices once charging starts."
              : "No commission on work won, no charge per enquiry, no minimum term."
          }
        />
        {ONBOARDING_FREE && (
          <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
            Join during onboarding and get 50% off for your first 12 months once charging starts.
            We'll email you at least 30 days before anything is charged, and you can leave any time.
          </p>
        )}
        <div
          className={`mt-10 grid gap-6 ${
            tiers.length > 2 ? "lg:grid-cols-3" : "mx-auto max-w-4xl sm:grid-cols-2"
          }`}
        >
          {tiers.map((t) => (
            <div
              key={t.slug}
              className={`flex flex-col rounded-md border bg-card p-8 ${
                t.featured ? "border-primary shadow-ember" : "border-border"
              }`}
            >
              <p className="eyebrow">{t.name}</p>
              <p className="mt-4 font-display text-4xl font-bold">
                {t.price}
                <span className="text-base font-medium text-muted-foreground">{t.per}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{t.line}</p>
              <ul className="mt-6 flex-1 space-y-3 border-t border-border pt-6 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              {ONBOARDING_FREE ? (
                <Link
                  to="/join"
                  className={`mt-8 flex items-center justify-center rounded-sm px-5 py-3 font-display text-sm font-semibold ${
                    t.featured
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : "border border-border-strong hover:border-primary hover:text-primary"
                  }`}
                >
                  Apply free
                </Link>
              ) : user ? (
                // Already signed in — go straight to checkout in the dashboard.
                <a
                  href="/dashboard?tab=plan"
                  className={`mt-8 flex items-center justify-center rounded-sm px-5 py-3 font-display text-sm font-semibold ${
                    t.featured
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : "border border-border-strong hover:border-primary hover:text-primary"
                  }`}
                >
                  Choose {t.name}
                </a>
              ) : (
                <Link
                  to="/signin"
                  search={{ plan: t.slug }}
                  className={`mt-8 flex items-center justify-center rounded-sm px-5 py-3 font-display text-sm font-semibold ${
                    t.featured
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : "border border-border-strong hover:border-primary hover:text-primary"
                  }`}
                >
                  Choose {t.name}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Running a bigger outfit with multiple teams?{" "}
          <Link to="/enterprise" className="text-primary hover:underline">
            Talk to us about contractor plans
          </Link>
          .
        </p>
      </Section>

      <Section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl leading-tight sm:text-4xl">Already listed with us?</h2>
          <p className="mt-4 text-muted-foreground">
            If we've built a profile for your business, claim it to add photos, set your postcodes
            and start receiving jobs.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/join"
              hash="find"
              className="rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Claim your listing
            </Link>
            <Link
              to="/waiting-list"
              search={{ role: "trader" as const }}
              className="rounded-sm border border-border-strong px-6 py-3.5 font-display font-semibold hover:border-primary hover:text-primary"
            >
              Join the waiting list for your area
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
