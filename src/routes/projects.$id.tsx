import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Section } from "@/components/layout-bits";
import {
  applyToProject,
  signProjectPhotos,
} from "@/lib/projects.functions";
import {
  formatBudget,
  myProProfileQuery,
  projectApplicationsQuery,
  projectQuery,
  tradesQuery,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { breadcrumbSchema, ldScript } from "@/lib/structured-data";

const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

export const Route = createFileRoute("/projects/$id")({
  loader: async ({ params }) => {
    if (!params.id) throw notFound();
    return { id: params.id };
  },
  head: ({ params }) => ({
    meta: [
      { title: "Project details — apply for this job | TradesmanFinder" },
      {
        name: "description",
        content:
          "Full brief for a homeowner project: scope, budget, target dates and photos. Vetted firms can apply directly.",
      },
      { property: "og:title", content: "Project details | TradesmanFinder" },
      {
        property: "og:description",
        content: "Scope, budget, dates and photos for a live homeowner project.",
      },
      { property: "og:type", content: "article" },
      {
        property: "og:url",
        content: `https://tradesmanfinder.org/projects/${params.id}`,
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://tradesmanfinder.org/projects/${params.id}`,
      },
    ],
    scripts: [
      ldScript(
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Project board", path: "/projects" },
          { name: "Project", path: `/projects/${params.id}` },
        ]),
      ),
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useLoaderData();
  const { user } = useAuth();
  const { data: project, isLoading } = useQuery(projectQuery(id));
  const { data: trades } = useQuery(tradesQuery);
  const { data: myPro } = useQuery(myProProfileQuery(user?.id));
  const sign = useServerFn(signProjectPhotos);
  const [photos, setPhotos] = useState<string[]>([]);

  const isOwner = !!user && project?.user_id === user.id;
  const applications = useQuery({
    ...projectApplicationsQuery(id),
    enabled: isOwner,
  });

  useEffect(() => {
    if (!project || project.status !== "published") return;
    if ((project.photos ?? []).length === 0) return;
    void sign({ data: { projectId: project.id } }).then((r) =>
      setPhotos(r.urls),
    );
  }, [project, sign]);

  if (isLoading) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading project…</p>
      </Section>
    );
  }

  if (!project || (project.status !== "published" && !isOwner)) {
    return (
      <Section>
        <h1 className="text-3xl">This project isn't available</h1>
        <p className="mt-4 text-muted-foreground">
          It may have been closed or is still in review.
        </p>
        <Link
          to="/projects"
          className="mt-6 inline-flex rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
        >
          Back to the board
        </Link>
      </Section>
    );
  }

  const tradeName =
    trades?.find((t) => t.slug === project.trade_slug)?.name ?? "General work";

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="eyebrow">{tradeName}</p>
          <h1 className="mt-3 text-4xl leading-tight">{project.title}</h1>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> {project.postcode}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {project.start_date
                ? `From ${new Date(project.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                : "Dates flexible"}
            </div>
            <div className="font-display text-foreground">
              {formatBudget(project.budget_min, project.budget_max)}
            </div>
          </dl>

          <p className="mt-8 whitespace-pre-line leading-relaxed text-muted-foreground">
            {project.description}
          </p>

          {photos.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xl">Photos from the homeowner</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {photos.map((src, i) => (
                  <li key={src}>
                    <img
                      src={src}
                      alt={`${project.title} — homeowner photo ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full rounded-sm border border-border object-cover"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && (
            <div className="mt-12 rounded-md border border-border bg-card p-6">
              <p className="eyebrow flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Firms that applied
              </p>
              {(applications.data?.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No applications yet. We'll email you as soon as a vetted firm
                  applies.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {applications.data!.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-sm border border-border p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <Link
                          to="/pro/$id"
                          params={{ id: a.pro_id }}
                          className="font-display font-semibold hover:text-primary"
                        >
                          View firm profile
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {a.quote_low || a.quote_high
                            ? formatBudget(a.quote_low, a.quote_high)
                            : "Quote on visit"}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {a.message}
                      </p>
                      {a.available_from && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Available from{" "}
                          {new Date(a.available_from).toLocaleDateString(
                            "en-GB",
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside>
          {myPro?.published ? (
            <ApplyPanel projectId={project.id} proId={myPro.id} />
          ) : isOwner ? (
            <div className="rounded-md border border-border bg-card p-6">
              <p className="font-display font-semibold">This is your posting</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Status: {project.status}. Applications appear on this page and
                in your account.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card p-6">
              <p className="font-display font-semibold">Are you a firm?</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Only certified, published firms can apply to projects. Get your
                firm verified and you can quote directly here.
              </p>
              <Link
                to="/claim"
                className="mt-5 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
              >
                Get certified
              </Link>
            </div>
          )}
        </aside>
      </div>
    </Section>
  );
}

function ApplyPanel({
  projectId,
  proId,
}: {
  projectId: string;
  proId: string;
}) {
  const apply = useServerFn(applyToProject);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    message: "",
    quoteLow: "",
    quoteHigh: "",
    availableFrom: "",
  });

  const mutation = useMutation({
    mutationFn: async () =>
      apply({
        data: {
          projectId,
          proId,
          message: form.message,
          quoteLow: form.quoteLow ? Number(form.quoteLow) : undefined,
          quoteHigh: form.quoteHigh ? Number(form.quoteHigh) : undefined,
          availableFrom: form.availableFrom || undefined,
        },
      }),
    onSuccess: () => {
      setDone(true);
      toast.success("Application sent to the homeowner");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (done) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <p className="font-display font-semibold text-success">
          Application sent
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The homeowner has your quote and message. They'll contact you directly
          if it's a fit.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-md border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="eyebrow">Apply for this project</p>

      <label className="mt-5 block text-sm">
        Your message
        <textarea
          required
          rows={5}
          minLength={20}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="How you'd approach the job, similar work you've done, what your price includes."
          className={field}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Quote from (£)
          <input
            type="number"
            min={0}
            value={form.quoteLow}
            onChange={(e) => setForm({ ...form, quoteLow: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Quote to (£)
          <input
            type="number"
            min={0}
            value={form.quoteHigh}
            onChange={(e) => setForm({ ...form, quoteHigh: e.target.value })}
            className={field}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        Available from
        <input
          type="date"
          value={form.availableFrom}
          onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
          className={field}
        />
      </label>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-6 w-full rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
