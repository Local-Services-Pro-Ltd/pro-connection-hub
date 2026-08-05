import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Star, ShieldCheck, Clock, MapPin, ArrowLeft, Check } from "lucide-react";
import { pros, type Pro } from "@/lib/site-data";
import { Section } from "@/components/layout-bits";
import pro1 from "@/assets/pro-1.jpg";
import pro2 from "@/assets/pro-2.jpg";
import pro3 from "@/assets/pro-3.jpg";

const photos = { 1: pro1, 2: pro2, 3: pro3 };

export const Route = createFileRoute("/pro/$id")({
  loader: ({ params }) => {
    const pro = pros.find((p) => p.id === params.id);
    if (!pro) throw notFound();
    return { pro };
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
    const { pro } = loaderData;
    const title = `${pro.company} — ${pro.trade} in ${pro.area} | TradesmanFinder`;
    const description = `${pro.bio} Rated ${pro.rating}/5 from ${pro.reviews} reviews.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProProfile,
});

function ProProfile() {
  const { pro } = Route.useLoaderData() as { pro: Pro };

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
          <Link
            to="/trades/$trade"
            params={{ trade: pro.tradeSlug }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All {pro.trade.toLowerCase()}s
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <img
              src={photos[pro.photo]}
              alt={`${pro.name}, ${pro.trade}`}
              width={800}
              height={800}
              className="h-56 w-full rounded-md border border-border object-cover object-top lg:h-[220px]"
            />
            <div className="min-w-0">
              <p className="eyebrow">{pro.trade}</p>
              <h1 className="mt-3 text-4xl leading-tight lg:text-5xl">
                {pro.company}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {pro.name} · {pro.years} years trading
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-accent text-accent" />
                  <strong className="font-display">{pro.rating}</strong>
                  <span className="text-muted-foreground">
                    ({pro.reviews} reviews)
                  </span>
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {pro.area}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Replies in ~{pro.responseMins}{" "}
                  min
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section className="!py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <h2 className="text-2xl">About</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              {pro.bio}
            </p>

            <h2 className="mt-12 text-2xl">Services</h2>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
              {pro.services.map((s) => (
                <li
                  key={s}
                  className="flex items-center gap-3 bg-card px-5 py-4 text-sm"
                >
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {s}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl">Checks & credentials</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {pro.verified.map((v) => (
                <li
                  key={v}
                  className="flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
                >
                  <ShieldCheck className="h-4 w-4 text-success" />
                  {v}
                </li>
              ))}
            </ul>
          </div>

          <aside className="h-fit rounded-md border border-border bg-card p-6 lg:sticky lg:top-24">
            <p className="eyebrow">Request a quote</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Describe your job and {pro.name.split(" ")[0]} will come back to
              you with a price. No fee, no obligation.
            </p>
            <Link
              to="/post-job"
              className="mt-6 flex items-center justify-center rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Request a quote
            </Link>
            <Link
              to="/trades/$trade"
              params={{ trade: pro.tradeSlug }}
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
