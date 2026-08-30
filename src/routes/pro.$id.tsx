import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Star, Clock, ShieldCheck, MapPin, Hammer } from "lucide-react";
import { Section } from "@/components/layout-bits";
import { ReviewPanel } from "@/components/review-panel";
import { ProjectGallery } from "@/components/project-gallery";
import { BookingPanel } from "@/components/booking-panel";
import { TrustBadge, TrustBreakdown } from "@/components/trust-badge";
import {
  proQuery,
  availabilityLabels,
  proProjectsQuery,
  proTrustQuery,
} from "@/lib/queries";
import pro1 from "@/assets/pro-1.jpg";
import pro2 from "@/assets/pro-2.jpg";
import pro3 from "@/assets/pro-3.jpg";

const photos: Record<number, string> = { 1: pro1, 2: pro2, 3: pro3 };


export const Route = createFileRoute("/pro/$id")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(proQuery(params.id));
    if (!data.pro) throw notFound();
    return { name: data.pro.company, pro: data.pro };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Tradesman not found | TradesmanFinder" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.pro;
    const title = `${p.company} — ${p.name}, ${p.area} | TradesmanFinder`;
    const description = `${p.company} in ${p.area}. ${p.rating}★ from ${p.review_count} reviews, ${p.years} years' experience. ${p.bio}`.slice(
      0,
      158,
    );
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
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

function ProPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(proQuery(id));
  const { data: projects } = useQuery(proProjectsQuery(id));
  const { data: trust } = useQuery(proTrustQuery(id));
  const pro = data.pro!;

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
            className="aspect-square w-full rounded-md border border-border object-cover object-top"
          />
          <div>
            <p className="eyebrow capitalize">
              {pro.trade_slug.replace("-", " ")}
            </p>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
              {pro.company}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">{pro.name}</p>
            {trust && (
              <div className="mt-4">
                <TrustBadge score={trust.score ?? 0} size="lg" />
              </div>
            )}


            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-6 text-sm">
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <strong className="font-display">
                  {pro.review_count ? pro.rating : "New"}
                </strong>
                <span className="text-muted-foreground">
                  ({pro.review_count} reviews)
                </span>
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                {pro.area}
                {pro.postcode ? ` · ${pro.postcode}` : ""}
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />~{pro.response_mins}{" "}
                min reply
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Hammer className="h-4 w-4 text-primary" />
                {pro.years} years' experience
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" />
                {availabilityLabels[pro.availability]}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h2 className="text-2xl">About</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              {pro.bio}
            </p>

            <h2 className="mt-12 text-2xl">Services</h2>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
              {pro.services.map((s) => (
                <li key={s} className="bg-card px-5 py-4 text-sm">
                  {s}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl">Checks & credentials</h2>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
              {credentials.map((c) => (
                <li key={c.id} className="bg-card px-5 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck
                      className={`h-4 w-4 ${c.verified ? "text-success" : "text-muted-foreground"}`}
                    />
                    <span>{c.label}</span>
                  </div>
                  <p className="mt-1.5 pl-6 text-xs text-muted-foreground">
                    {c.verified
                      ? `Verified${c.verified_at ? ` ${new Date(c.verified_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}`
                      : "Awaiting verification"}
                    {c.reference ? ` · Ref ${c.reference}` : ""}
                    {c.expires_on
                      ? ` · Expires ${new Date(c.expires_on).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
                      : ""}
                  </p>
                </li>
              ))}
              {credentials.length === 0 && (
                <li className="bg-card px-5 py-4 text-sm text-muted-foreground">
                  No credentials uploaded yet.
                </li>
              )}
            </ul>

            <ReviewPanel proId={pro.id} reviews={reviews} />
          </div>

          <aside className="h-fit rounded-md border border-border bg-card p-6 lg:sticky lg:top-24">
            <p className="eyebrow">Request a quote</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Describe your job and {pro.name.split(" ")[0]} will come back to
              you with a price. No fee, no obligation.
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
      </Section>
    </>
  );
}
