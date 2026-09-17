import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import {
  formatBudget,
  projectApplicationCountsQuery,
  publishedProjectsQuery,
  tradesQuery,
} from "@/lib/queries";
import { breadcrumbSchema, ldScript, organizationSchema } from "@/lib/structured-data";

const url = "https://tradesmanfinder.org/projects";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Live project board — jobs waiting for quotes | TradesmanFinder" },
      {
        name: "description",
        content:
          "Browse UK home projects posted by homeowners — budget, dates and photos included. Vetted firms can apply directly.",
      },
      { property: "og:title", content: "Live project board | TradesmanFinder" },
      {
        property: "og:description",
        content:
          "Real homeowner projects with budgets, dates and photos. Vetted firms apply directly.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      ldScript(organizationSchema()),
      ldScript(
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Project board", path: "/projects" },
        ]),
      ),
    ],
  }),
  // Resolve the board on the server so the page never ships a permanent
  // "loading" state if hydration is slow or blocked.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(publishedProjectsQuery()),
  component: ProjectBoard,
});

function ProjectBoard() {
  const { data: projects } = useSuspenseQuery(publishedProjectsQuery());
  const { data: counts } = useQuery(projectApplicationCountsQuery);
  const { data: trades } = useQuery(tradesQuery);
  const tradeName = (slug: string | null) =>
    trades?.find((t) => t.slug === slug)?.name ?? "General work";

  return (
    <Section>
      <SectionHead
        eyebrow="Project board"
        title="Live projects waiting for quotes"
        sub="Homeowners post the job — budget, dates and photos. Every posting is reviewed before it goes live, and only vetted firms can apply."
        aside={
          <Link
            to="/projects/new"
            preload="render"
            className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Post your project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            No live projects right now. Post yours and vetted firms in your area
            will see it as soon as it clears review.
          </p>
          <Link
            to="/projects/new"
            preload="render"
            className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Post your project
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col rounded-md border border-border bg-card p-6"
            >
              <p className="eyebrow">{tradeName(p.trade_slug)}</p>
              <h2 className="mt-3 text-xl leading-snug">
                <Link
                  to="/projects/$id"
                  params={{ id: p.id }}
                  preload="intent"
                  className="hover:text-primary"
                >
                  {p.title}
                </Link>
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {p.postcode}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {p.start_date
                    ? `From ${new Date(p.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : "Dates flexible"}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {counts?.[p.id] ?? 0} firms applied
                </div>
              </dl>
              <p className="mt-4 font-display text-lg">
                {formatBudget(p.budget_min, p.budget_max)}
              </p>
              <Link
                to="/projects/$id"
                params={{ id: p.id }}
                preload="intent"
                className="mt-5 inline-flex justify-center rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
              >
                View project
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
