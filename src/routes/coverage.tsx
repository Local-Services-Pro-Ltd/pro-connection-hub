import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { WaitingListInline } from "@/components/waiting-list-inline";
import {
  areasQuery,
  waitingListDemandQuery,
  waitingListTrendQuery,
} from "@/lib/queries";

const SITE = "https://tradesmanfinder.org";
const TARGET = 25; // confirmed sign-ups we like to see before opening an area

export const Route = createFileRoute("/coverage")({
  head: () => {
    const description =
      "See which UK postcode areas TradesmanFinder is live in, which are close to opening, and where demand is building. Add your postcode to move yours up the queue.";
    return {
      meta: [
        { title: "Area launch tracker | TradesmanFinder" },
        { name: "description", content: description },
        { property: "og:title", content: "Where TradesmanFinder opens next" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Where TradesmanFinder opens next" },
        { name: "twitter:description", content: description },
        { property: "og:url", content: `${SITE}/coverage` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/coverage` }],
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
  component: Coverage,
});

/**
 * Weekly confirmed sign-ups per area over the recent trend window, used to
 * project when an area is likely to reach the launch threshold. Aggregate
 * figures only — nothing personal is involved.
 */
function weeklyRates(
  trend: { postcode_area: string; week: string; signups: number }[],
) {
  const byArea = new Map<string, number[]>();
  for (const p of trend) {
    const list = byArea.get(p.postcode_area) ?? [];
    list.push(Number(p.signups));
    byArea.set(p.postcode_area, list);
  }
  const rates = new Map<string, number>();
  for (const [area, weeks] of byArea) {
    const recent = weeks.slice(-4);
    const sum = recent.reduce((a, b) => a + b, 0);
    rates.set(area, recent.length ? sum / recent.length : 0);
  }
  return rates;
}

/** Human-readable launch window for an area, or null when it's too early. */
function launchWindow(total: number, perWeek: number) {
  if (total >= TARGET) return "Opening next — final checks under way";
  if (perWeek <= 0.25) return null;
  const weeks = Math.ceil((TARGET - total) / perWeek);
  if (weeks > 78) return null;

  const from = new Date();
  from.setDate(from.getDate() + weeks * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + Math.max(14, Math.round(weeks * 0.4) * 7));

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const a = fmt(from);
  const b = fmt(to);
  return a === b ? `Estimated launch: ${a}` : `Estimated launch: ${a}–${b}`;
}

function statusFor(total: number) {
  if (total >= TARGET)
    return { label: "Nearly there", tone: "text-primary" as const };
  if (total >= Math.round(TARGET * 0.5))
    return { label: "Demand building", tone: "text-foreground" as const };
  return { label: "Early interest", tone: "text-muted-foreground" as const };
}

function Coverage() {
  const { data: areas = [] } = useQuery(areasQuery);
  const { data: demand = [], isPending } = useQuery(waitingListDemandQuery);
  const { data: trend = [] } = useQuery(waitingListTrendQuery(8));

  const live = areas.filter((a) => a.status === "live");
  const queue = demand.slice(0, 12);
  const rates = weeklyRates(trend);

  return (
    <>
      <Section>
        <div className="max-w-2xl">
          <p className="eyebrow">Launch tracker</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
            Where we open next is decided by you.
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            We open an area once enough homeowners and vetted trades have put
            their postcode forward — roughly {TARGET} confirmed sign-ups in a
            postcode area is where it starts to make sense. Here's exactly where
            things stand.
          </p>
        </div>
      </Section>

      <Section className="border-y border-border bg-surface">
        <SectionHead
          eyebrow="Live now"
          title="Open for business."
          sub="Post a job in these areas today and vetted local trades will come back to you."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {live.map((a) => (
            <div
              key={a.slug}
              className="rounded-md border border-border bg-card p-7"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-1 font-display text-[0.7rem] uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Live
              </span>
              <h2 className="mt-5 text-2xl">{a.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {a.note}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          eyebrow="In the queue"
          title="Postcode areas building demand."
          sub="Counts are confirmed sign-ups only — homeowners and trades combined. No personal details are shown or shared."
        />

        {isPending ? (
          <p className="mt-8 text-muted-foreground">Loading demand…</p>
        ) : queue.length === 0 ? (
          <p className="mt-8 max-w-xl text-muted-foreground">
            No confirmed sign-ups outside our live areas yet. Add your postcode
            below and yours will be the first on the board.
          </p>
        ) : (
          <ul className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {queue.map((d) => {
              const status = statusFor(d.total);
              const pct = Math.min(100, Math.round((d.total / TARGET) * 100));
              return (
                <li key={d.postcode_area} className="bg-card p-7">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 font-display text-lg font-semibold">
                      <MapPin
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {d.postcode_area}
                    </span>
                    <span
                      className={`font-display text-xs uppercase tracking-widest ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div
                    className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${d.postcode_area} progress towards launch`}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {d.total} waiting — {d.homeowners} homeowner
                    {d.homeowners === 1 ? "" : "s"}, {d.traders} trade
                    {d.traders === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {launchWindow(d.total, rates.get(d.postcode_area) ?? 0) ??
                      "Estimated launch: not enough demand yet to call it"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section className="border-y border-border bg-surface">
        <SectionHead
          eyebrow="Demand over time"
          title="How fast each area is growing."
          sub="Confirmed sign-ups per week over the last eight weeks, and the running total. Launch estimates above project the recent four-week rate onto our ~25 sign-up threshold — a guide, not a promise."
        />
        <TrendBoard trend={trend} />
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Add your postcode</p>
            <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
              Move your area up the queue.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <TrendingUp
                className="mr-2 inline h-4 w-4 text-primary"
                aria-hidden="true"
              />
              Every confirmed sign-up counts towards opening your postcode.
              Trades count double in practice — we can't open an area without
              people to do the work.
            </p>
            <Link
              to="/areas"
              className="mt-6 inline-flex font-display text-sm font-semibold text-primary underline underline-offset-4"
            >
              See our live coverage map
            </Link>
          </div>
          <WaitingListInline source="coverage_page" />
        </div>
      </Section>
    </>
  );
}

/** Aggregate-only sparklines: weekly confirmed sign-ups per postcode area. */
function TrendBoard({
  trend,
}: {
  trend: {
    postcode_area: string;
    week: string;
    signups: number;
    cumulative: number;
  }[];
}) {
  if (trend.length === 0) {
    return (
      <p className="mt-8 max-w-xl text-muted-foreground">
        No confirmed sign-ups in the last eight weeks yet — as soon as people
        start joining, the weekly growth for each area shows up here.
      </p>
    );
  }

  const byArea = new Map<string, typeof trend>();
  for (const point of trend) {
    const list = byArea.get(point.postcode_area) ?? [];
    list.push(point);
    byArea.set(point.postcode_area, list);
  }

  const areas = [...byArea.entries()]
    .sort(
      (a, b) =>
        Number(b[1][b[1].length - 1]?.cumulative ?? 0) -
        Number(a[1][a[1].length - 1]?.cumulative ?? 0),
    )
    .slice(0, 6);

  return (
    <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {areas.map(([area, points]) => {
        const peak = Math.max(...points.map((p) => Number(p.signups)), 1);
        const total = Number(points[points.length - 1]?.cumulative ?? 0);
        const latest = Number(points[points.length - 1]?.signups ?? 0);
        return (
          <li
            key={area}
            className="rounded-md border border-border bg-card p-6"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold">{area}</span>
              <span className="font-display text-sm text-muted-foreground">
                {total} confirmed
              </span>
            </div>
            <div
              className="mt-5 flex h-16 items-end gap-1.5"
              role="img"
              aria-label={`${area}: ${points
                .map(
                  (p) =>
                    `${new Date(p.week).toLocaleDateString("en-GB")} ${p.signups}`,
                )
                .join(", ")}`}
            >
              {points.map((p) => (
                <span
                  key={p.week}
                  className="flex-1 rounded-t-sm bg-primary/70"
                  style={{
                    height: `${Math.max(6, (Number(p.signups) / peak) * 100)}%`,
                  }}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {latest} new in the latest week
            </p>
          </li>
        );
      })}
    </ul>
  );
}
