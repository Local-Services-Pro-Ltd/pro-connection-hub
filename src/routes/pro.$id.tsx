import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Star, ShieldCheck, MapPin, Hammer, CircleAlert, Clock3 } from "lucide-react";
import { Section } from "@/components/layout-bits";
import { ReviewPanel } from "@/components/review-panel";
import { ProjectGallery } from "@/components/project-gallery";
import { BookingPanel } from "@/components/booking-panel";
import { LeadForm } from "@/components/lead-form";

import { SaveProButton } from "@/components/save-pro-button";
import { tradeHero } from "@/lib/trade-media";

import { areasQuery, proQuery, proProjectsQuery, type Credential } from "@/lib/queries";
import { credentialRegister, credentialRegisterUrl, credentialState } from "@/lib/registers";
import { formatProLocation } from "@/lib/pro-location";
import { breadcrumbSchema, ldScript, organizationSchema } from "@/lib/structured-data";

import pro1 from "@/assets/pro-1.jpg";
import pro2 from "@/assets/pro-2.jpg";
import pro3 from "@/assets/pro-3.jpg";

const photos: Record<number, string> = { 1: pro1, 2: pro2, 3: pro3 };

export const Route = createFileRoute("/pro/$id")({
  loader: async ({ params, context }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(proQuery(params.id)),
      context.queryClient.ensureQueryData(areasQuery),
    ]);
    if (!data.pro) throw notFound();
    return {
      name: data.pro.company,
      pro: data.pro,
      reviewCount: data.reviews.length,
    };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Tradesman not found | TradesmanFinder" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.pro;
    const url = `https://tradesmanfinder.org/pro/${params.id}`;
    const image = `https://tradesmanfinder.org${tradeHero(p.trade_slug)}`;
    const title = `${p.company} — ${p.name}, ${p.area} | TradesmanFinder`;
    const description =
      `${p.company} in ${p.area}. ${p.is_demo ? "Example listing, not a real firm" : "Vetting in progress"}. ${p.years} years' experience. ${p.bio}`.slice(
        0,
        158,
      );
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: p.company,
      description,
      url,
      areaServed: p.area,
      address: { "@type": "PostalAddress", addressLocality: p.area, addressCountry: "GB" },
      employee: { "@type": "Person", name: p.name },
    };
    if ((loaderData.reviewCount ?? 0) > 0) {
      jsonLd["aggregateRating"] = {
        "@type": "AggregateRating",
        ratingValue: p.rating,
        reviewCount: loaderData.reviewCount,
        bestRating: 5,
        worstRating: 1,
      };
    }
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { property: "og:image", content: image },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
        ldScript(organizationSchema()),
        ldScript(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Trades", path: "/trades" },
            {
              name: p.trade_slug.replace(/-/g, " "),
              path: `/trades/${p.trade_slug}`,
            },
            { name: p.company, path: `/pro/${params.id}` },
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
      <h1 className="text-3xl">We can't find that tradesman</h1>
      <Link to="/trades" className="mt-4 inline-block text-primary hover:underline">
        Browse all trades
      </Link>
    </Section>
  ),
  component: ProPage,
});

function formatCredentialDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function CredentialItem({ credential }: { credential: Credential }) {
  const state = credentialState(credential);
  const register = credentialRegister(credential.kind);
  const registerUrl = credentialRegisterUrl(credential.kind, credential.reference);
  const Icon = state === "verified" ? ShieldCheck : state === "expired" ? CircleAlert : Clock3;
  const status =
    state === "verified"
      ? credential.verified_at
        ? `Checked on ${formatCredentialDate(credential.verified_at)}`
        : "Checked"
      : state === "expired"
        ? `Expired ${formatCredentialDate(credential.expires_on!)} — awaiting renewal`
        : "Not yet checked";

  return (
    <li className="bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-sm">
        <Icon
          className={`h-4 w-4 shrink-0 ${
            state === "verified"
              ? "text-success"
              : state === "expired"
                ? "text-primary"
                : "text-muted-foreground"
          }`}
          aria-hidden="true"
        />
        <span>{credential.label}</span>
      </div>
      <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{status}</p>
      {credential.reference && (
        <p className="mt-1 pl-6 text-xs text-muted-foreground">Ref {credential.reference}</p>
      )}
      {state === "verified" && credential.expires_on && (
        <p className="mt-1 pl-6 text-xs text-muted-foreground">
          Expires {formatCredentialDate(credential.expires_on)}
        </p>
      )}
      {registerUrl && (
        <a
          href={registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block pl-6 text-xs text-primary underline underline-offset-4"
        >
          Check on the {register.label} website
        </a>
      )}
    </li>
  );
}

function ProPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(proQuery(id));
  const { data: areas } = useSuspenseQuery(areasQuery);
  const { data: projects } = useQuery(proProjectsQuery(id));
  const pro = data.pro!;
  const location = formatProLocation(pro, areas);

  const { credentials, reviews } = data;

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8 lg:py-20">
          <img
            src={photos[pro.photo] ?? pro1}
            alt={`${pro.name} of ${pro.company}`}
            width={800}
            height={800}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="aspect-square w-full rounded-md border border-border object-cover object-top"
          />

          <div>
            <p className="eyebrow capitalize">{pro.trade_slug.replace("-", " ")}</p>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{pro.company}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{pro.name}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="rounded-sm bg-muted px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {pro.is_demo ? "Example listing" : "Vetting in progress"}
              </span>
              <SaveProButton proId={pro.id} company={pro.company} />
            </div>

            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-6 text-sm">
              {reviews.length > 0 ? (
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-accent text-accent" />
                  <strong className="font-display">{pro.rating}</strong>
                  <span className="text-muted-foreground">
                    ({reviews.length} review{reviews.length === 1 ? "" : "s"})
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">New</span>
              )}
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                {location}
                {pro.postcode ? ` · ${pro.postcode}` : ""}
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Hammer className="h-4 w-4 text-primary" />
                {pro.years} years' experience
              </span>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h2 className="text-2xl">About</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{pro.bio}</p>

            <h2 className="mt-12 text-2xl">Services</h2>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
              {pro.services.map((s) => (
                <li key={s} className="bg-card px-5 py-4 text-sm">
                  {s}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl">Checks & credentials</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We check these against the official registers ourselves. You can check them too using
              the links below.{" "}
              <Link to="/verification" className="text-primary hover:underline">
                How we check firms
              </Link>
            </p>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
              {credentials.map((credential) => (
                <CredentialItem key={credential.id} credential={credential} />
              ))}
              {credentials.length === 0 && (
                <li className="bg-card px-5 py-4 text-sm text-muted-foreground">
                  No credentials uploaded yet.
                </li>
              )}
            </ul>

            <div className="mt-12">
              <ProjectGallery
                projects={projects ?? []}
                heading="Work gallery"
                emptyNote={`${pro.name.split(" ")[0]} hasn't published project photos yet. Ask for examples of previous work when you contact the firm.`}
              />
            </div>

            <ReviewPanel proId={pro.id} reviews={reviews} />
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            <BookingPanel proId={pro.id} proName={pro.name} postcode={pro.postcode ?? ""} />

            <LeadForm proId={pro.id} proName={pro.name} company={pro.company} />

            <aside className="rounded-md border border-border bg-card p-6">
              <p className="eyebrow">Request a quote</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Describe your job and {pro.name.split(" ")[0]} will come back to you with a price.
                No fee, no obligation.
              </p>
              {pro.day_rate && (
                <p className="mt-4 font-display text-lg">
                  From £{pro.day_rate}
                  <span className="text-sm text-muted-foreground"> / day</span>
                </p>
              )}
              <Link
                to="/post-job"
                search={{ trade: pro.trade_slug, pro: pro.id }}
                className="mt-6 flex items-center justify-center rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
              >
                Request a quote
              </Link>
              <Link
                to="/trades/$trade"
                params={{ trade: pro.trade_slug }}
                search={pro.area_slug ? { area: pro.area_slug } : {}}
                className="mt-3 flex items-center justify-center rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Compare similar pros
              </Link>
            </aside>
          </div>
        </div>
      </Section>
    </>
  );
}
