import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { PageHero, Section, SectionHead } from "@/components/layout-bits";
import { getRequestOrigin } from "@/lib/origin.functions";
import { plansQuery } from "@/lib/queries";
import heroForTradesmen from "@/assets/hero-for-tradesmen.jpg";

export const Route = createFileRoute("/for-tradesmen")({
  loader: async ({ context }) => {
    const [, origin] = await Promise.all([
      context.queryClient.ensureQueryData(plansQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
  head: ({ loaderData }) => {
    const title =
      "Join as a tradesman — real leads, no lead fees | TradesmanFinder";
    const description =
      "Get matched to homeowners in your postcodes. One flat monthly membership, no per-lead charges, no bidding wars.";
    const base = loaderData?.origin ?? "";
    const image = loaderData?.origin
      ? `${loaderData.origin}/og/for-tradesmen.jpg`
      : undefined;
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
    title: "No pay-per-lead",
    body: "One flat monthly fee. You're never charged for a job you didn't win, or a caller who never picks up.",
  },
  {
    title: "Three quotes, not thirty",
    body: "Each job goes to a maximum of three trades. You're competing on merit, not on being first to dial.",
  },
  {
    title: "Your postcodes only",
    body: "You set the areas you genuinely cover. We don't send you a job ninety minutes down the motorway.",
  },
  {
    title: "Reviews you own",
    body: "Your review history and verified checks live on a profile you can link to from anywhere.",
  },
];

function ForTradesmen() {
  const { data: tiers } = useSuspenseQuery(plansQuery);
  return (
    <>
      <PageHero
        eyebrow="For tradesmen"
        title="Leads that are worth answering."
        sub="A flat monthly membership, a cap of three quotes per job, and homeowners who already know what they want. That's the whole model."
        image={heroForTradesmen}
        imageAlt="A tradesman checking his phone beside his van at sunrise"
        focal="55% 40%"
        focalMobile="65% 42%"
      >

        <Link
          to="/signin"
          className="inline-flex rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
        >
          Apply to join
        </Link>
      </PageHero>

      <Section>
        <SectionHead eyebrow="Why bother" title="Built by people sick of lead fees." />
        <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {perks.map((p) => (
            <div key={p.title} className="bg-card p-8">
              <h3 className="text-xl">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-y border-border bg-surface">
        <SectionHead
          eyebrow="Membership"
          title="One price. Cancel any month."
          sub="No commission on work won, no charge per enquiry, no minimum term."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col rounded-md border bg-card p-8 ${
                t.featured
                  ? "border-primary shadow-ember"
                  : "border-border"
              }`}
            >
              <p className="eyebrow">{t.name}</p>
              <p className="mt-4 font-display text-4xl font-bold">
                {t.price}
                <span className="text-base font-medium text-muted-foreground">
                  {t.per}
                </span>
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
              <Link
                to="/signin"
                className={`mt-8 flex items-center justify-center rounded-sm px-5 py-3 font-display text-sm font-semibold ${
                  t.featured
                    ? "bg-primary text-primary-foreground hover:brightness-110"
                    : "border border-border-strong hover:border-primary hover:text-primary"
                }`}
              >
                Choose {t.name}
              </Link>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
