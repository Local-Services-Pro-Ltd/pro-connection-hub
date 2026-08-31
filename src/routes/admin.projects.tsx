import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { reviewProject } from "@/lib/projects.functions";
import {
  adminProjectsQuery,
  formatBudget,
  isAdminQuery,
  projectStatusLabels,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";

const filters = ["pending", "published", "rejected", "closed", "all"] as const;

export const Route = createFileRoute("/admin/projects")({
  head: () => ({
    meta: [
      { title: "Project review queue — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Internal queue for reviewing homeowner project postings before they reach vetted firms.",
      },
      { property: "og:title", content: "Project review queue — admin" },
      {
        property: "og:description",
        content: "Internal moderation queue for homeowner project postings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProjects,
});

function AdminProjects() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: checking } = useQuery(
    isAdminQuery(user?.id),
  );
  const queryClient = useQueryClient();
  const { data: projects } = useQuery({
    ...adminProjectsQuery,
    enabled: !!isAdmin,
  });
  const review = useServerFn(reviewProject);
  const [filter, setFilter] = useState<(typeof filters)[number]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const decide = useMutation({
    mutationFn: async (input: {
      projectId: string;
      status: "published" | "rejected";
    }) =>
      review({
        data: {
          projectId: input.projectId,
          status: input.status,
          reviewerNote: notes[input.projectId] ?? undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Decision saved and the homeowner has been emailed");
      void queryClient.invalidateQueries({ queryKey: ["admin", "projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || checking) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking access…</p>
      </Section>
    );
  }

  if (!isAdmin) {
    return (
      <Section>
        <div className="mx-auto max-w-md rounded-md border border-border bg-card p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-primary" />
          <h1 className="mt-4 text-2xl">Admins only</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This queue is restricted to the moderation team.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Back to site
          </Link>
        </div>
      </Section>
    );
  }

  const rows = (projects ?? []).filter((p) =>
    filter === "all" ? true : p.status === filter,
  );

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Project review queue"
        sub="Approve postings before vetted firms can see them, or reject with a note the homeowner receives by email."
      />

      <div className="mt-8 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-sm border px-3 py-1.5 font-display text-xs font-semibold capitalize ${
              filter === f
                ? "border-primary text-primary"
                : "border-border-strong text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Nothing in this view.
        </p>
      ) : (
        <ul className="mt-8 space-y-6">
          {rows.map((p) => (
            <li key={p.id} className="rounded-md border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="eyebrow">{p.reference}</p>
                  <h2 className="mt-2 text-xl">{p.title}</h2>
                </div>
                <span className="rounded-sm border border-border-strong px-3 py-1 text-xs text-muted-foreground">
                  {projectStatusLabels[p.status] ?? p.status}
                </span>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>

              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                <div>{p.postcode}</div>
                <div>{formatBudget(p.budget_min, p.budget_max)}</div>
                <div>{p.trade_slug ?? "general"}</div>
                <div>{(p.photos ?? []).length} photos</div>
                <div>
                  {p.contact_name} · {p.contact_email}
                </div>
              </dl>

              {p.status === "pending" && (
                <div className="mt-5 border-t border-border pt-5">
                  <label className="block text-sm">
                    Reviewer note (sent if rejected)
                    <textarea
                      rows={2}
                      value={notes[p.id] ?? ""}
                      onChange={(e) =>
                        setNotes({ ...notes, [p.id]: e.target.value })
                      }
                      className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ projectId: p.id, status: "published" })
                      }
                      className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ projectId: p.id, status: "rejected" })
                      }
                      className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <Link
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              )}

              {p.reviewer_note && p.status !== "pending" && (
                <p className="mt-4 rounded-sm border border-border p-3 text-sm text-muted-foreground">
                  Reviewer note: {p.reviewer_note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
