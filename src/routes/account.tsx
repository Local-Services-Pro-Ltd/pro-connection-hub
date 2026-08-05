import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Section, PageHero } from "@/components/layout-bits";
import { myJobsQuery, myReviewsQuery } from "@/lib/queries";
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
        sub={user.email ?? undefined}
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
