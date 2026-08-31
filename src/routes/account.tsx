import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Section, PageHero } from "@/components/layout-bits";
import {
  formatBudget,
  myJobsQuery,
  myLeadsQuery,
  myProjectsQuery,
  myReviewsQuery,
  projectStatusLabels,
  savedSearchesQuery,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — jobs, quotes and reviews | TradesmanFinder" },
      {
        name: "description",
        content:
          "Track the jobs you've posted, the quotes coming back and the reviews you've written on TradesmanFinder.",
      },
      { property: "og:title", content: "Your account — TradesmanFinder" },
      {
        property: "og:description",
        content: "Track your posted jobs and reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});

const statusLabels: Record<string, string> = {
  open: "Open — matching trades",
  matched: "Quotes received",
  closed: "Closed",
};

function Account() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/signin", search: { redirect: "/account" }, replace: true });
  }, [loading, user, navigate]);

  const jobs = useQuery({ ...myJobsQuery, enabled: !!user });
  const reviews = useQuery({ ...myReviewsQuery, enabled: !!user });

  if (loading || !user) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading your account…</p>
      </Section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Your account"
        title="Jobs, quotes and reviews."
        sub={user.email ?? "Signed in"}
      >
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/", replace: true });
          }}
          className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
        >
          Sign out
        </button>
      </PageHero>

      <Section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl">Posted jobs</h2>
          <Link
            to="/post-job"
            search={{}}
            className="text-sm text-primary hover:underline"
          >
            Post a new job
          </Link>
        </div>

        {jobs.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
        ) : (jobs.data?.length ?? 0) > 0 ? (
          <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {jobs.data!.map((j) => (
              <li key={j.id} className="bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">{j.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {j.reference} · {j.postcode} · {j.timing}
                    </p>
                  </div>
                  <span className="rounded-sm border border-border px-3 py-1 font-display text-xs uppercase tracking-widest text-primary">
                    {statusLabels[j.status] ?? j.status}
                  </span>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {j.description}
                </p>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  Posted{" "}
                  {new Date(j.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            You haven't posted a job yet.
          </p>
        )}

        <div className="mt-14 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl">Project postings</h2>
          <Link to="/projects/new" className="text-sm text-primary hover:underline">
            Post a project
          </Link>
        </div>
        {projects.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
        ) : (projects.data?.length ?? 0) > 0 ? (
          <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {projects.data!.map((p) => (
              <li key={p.id} className="bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">
                      <Link
                        to="/projects/$id"
                        params={{ id: p.id }}
                        className="hover:text-primary"
                      >
                        {p.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.reference} · {p.postcode} ·{" "}
                      {formatBudget(p.budget_min, p.budget_max)}
                    </p>
                  </div>
                  <span className="rounded-sm border border-border px-3 py-1 font-display text-xs uppercase tracking-widest text-primary">
                    {projectStatusLabels[p.status] ?? p.status}
                  </span>
                </div>
                {p.reviewer_note && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Reviewer note: {p.reviewer_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            No project postings yet. Postings carry budget, dates and photos, so
            firms can quote accurately.
          </p>
        )}

        <h2 className="mt-14 text-2xl">Enquiries you've sent</h2>
        {leads.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
        ) : (leads.data?.length ?? 0) > 0 ? (
          <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {leads.data!.map((l) => (
              <li key={l.id} className="bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to="/pro/$id"
                    params={{ id: l.pro_id }}
                    className="text-lg hover:text-primary"
                  >
                    Enquiry {l.reference}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {l.message}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            You haven't messaged a firm yet.
          </p>
        )}

        <h2 className="mt-14 text-2xl">Saved searches</h2>
        {searches.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
        ) : (searches.data?.length ?? 0) > 0 ? (
          <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {searches.data!.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-card p-6"
              >
                <div>
                  <p className="font-display font-semibold">{s.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.trade_slug ?? "All trades"}
                    {s.area ? ` · ${s.area}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {s.trade_slug ? (
                    <Link
                      to="/trades/$trade"
                      params={{ trade: s.trade_slug }}
                      search={s.area ? { area: s.area } : {}}
                      className="text-sm text-primary hover:underline"
                    >
                      Run search
                    </Link>
                  ) : (
                    <Link
                      to="/trades"
                      className="text-sm text-primary hover:underline"
                    >
                      Run search
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSearch.mutate(s.id)}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            Save a search from the directory and it'll be one click away here.
          </p>
        )}

        <h2 className="mt-14 text-2xl">Your reviews</h2>
        {reviews.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
        ) : (reviews.data?.length ?? 0) > 0 ? (
          <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
            {reviews.data!.map((r) => (
              <li key={r.id} className="bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to="/pro/$id"
                    params={{ id: r.pro_id }}
                    className="text-lg hover:text-primary"
                  >
                    {r.title || "Review"}
                  </Link>
                  <span className="rounded-sm border border-border px-3 py-1 font-display text-xs uppercase tracking-widest text-muted-foreground">
                    {r.status === "published"
                      ? "Published"
                      : r.status === "pending"
                        ? "Awaiting verification"
                        : "Not published"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {r.body}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            You haven't written a review yet.
          </p>
        )}
      </Section>
    </>
  );
}
