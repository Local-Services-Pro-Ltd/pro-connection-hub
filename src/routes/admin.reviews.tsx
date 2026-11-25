import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { isAdminQuery } from "@/lib/queries";
import { RATING_FIELDS } from "@/lib/after-job.shared";
import {
  adminListReviews,
  adminModerateReply,
  adminModerateReview,
  type AdminReview,
} from "@/lib/reviews.functions";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews — admin | TradesmanFinder" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReviews,
});

const LABEL: Record<AdminReview["status"], string> = {
  pending: "Waiting for a decision",
  published: "Published",
  rejected: "Rejected",
};

function AdminReviews() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending } = useQuery({ ...isAdminQuery(user?.id), enabled: !loading });

  if (loading || (user && isPending)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user || !isAdmin) {
    return (
      <Section>
        <div className="max-w-xl rounded-md border border-border bg-card p-8">
          <h1 className="text-2xl">{user ? "Admins only" : "Sign in required"}</h1>
          <p className="mt-3 text-muted-foreground">
            {user
              ? "Your account does not hold the admin role."
              : "The admin area is only open to signed-in admins."}
          </p>
          {!user && (
            <Link
              to="/signin"
              search={{ redirect: "/admin/reviews" }}
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </Section>
    );
  }
  return <ReviewQueue />;
}

function ReviewQueue() {
  const queryClient = useQueryClient();
  const {
    data: reviews,
    isPending,
    error,
  } = useQuery({ queryKey: ["admin", "reviews"], queryFn: () => adminListReviews() });
  const decide = useMutation({
    mutationFn: (input: { id: string; status: AdminReview["status"] }) =>
      adminModerateReview({ data: input }),
    onSuccess: async (row) => {
      toast.success(row.status === "published" ? "Review published" : "Decision saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideReply = useMutation({
    mutationFn: (input: { id: string; status: "published" | "rejected" }) =>
      adminModerateReply({ data: input }),
    onSuccess: async () => {
      toast.success("Reply decision saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const waiting = (reviews ?? []).filter(
    (review) =>
      review.status === "pending" || review.reported_at || review.reply?.status === "pending",
  ).length;

  return (
    <Section>
      <Link to="/admin" className="text-sm text-primary hover:underline">
        ← Admin home
      </Link>
      <div className="mt-4">
        <SectionHead
          eyebrow="Admin"
          title="Reviews"
          sub="Publish a review if it relates to the job, contains no personal details or abuse, and isn't from the firm or someone connected to it. A low score is never a reason to reject."
        />
      </div>
      {isPending ? (
        <p className="mt-8 text-muted-foreground">Loading reviews…</p>
      ) : error ? (
        <p role="alert" className="mt-8 text-muted-foreground">
          {error.message}
        </p>
      ) : reviews.length === 0 ? (
        <p className="mt-8 max-w-2xl text-muted-foreground">
          No reviews yet. A review arrives here when a homeowner reviews the firm they chose for a
          completed job.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {waiting} waiting for a decision · {reviews.length} in total
          </p>
          <ul className="mt-4 grid gap-4">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-md border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg">{review.title || "Customer review"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      For {review.company} · by {review.author_name}
                      {review.author_place ? `, ${review.author_place}` : ""} ·{" "}
                      {new Date(review.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                    {review.rating} out of 5
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">
                  {review.body}
                </p>
                <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {RATING_FIELDS.filter((item) => review.ratings[item.key]).map((item) => (
                    <div key={item.key} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{item.label}</dt>
                      <dd>{review.ratings[item.key]} / 5</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">
                  {review.verified_job
                    ? `Verified job${review.job_reference ? ` ${review.job_reference}` : ""}: the homeowner accepted this firm's quote and marked the work complete.`
                    : "Not linked to a job."}
                </p>
                {review.reported_at ? (
                  <div className="mt-4 rounded-sm border border-primary p-4 text-sm">
                    <p className="font-semibold">The firm has reported this review</p>
                    <p className="mt-1 whitespace-pre-line text-muted-foreground">
                      {review.report_reason}
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      Publish again to keep it, or take it down. Either decision clears the report.
                      Tell both sides what you decided.
                    </p>
                  </div>
                ) : null}
                {review.reply ? (
                  <div className="mt-4 border-l-2 border-primary pl-4 text-sm">
                    <p className="font-semibold">
                      Firm's reply ·{" "}
                      {review.reply.status === "pending"
                        ? "waiting for a decision"
                        : review.reply.status}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-muted-foreground">
                      {review.reply.body}
                    </p>
                    {review.reply.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={decideReply.isPending}
                          onClick={() =>
                            decideReply.mutate({ id: review.reply!.id, status: "published" })
                          }
                          className="rounded-sm bg-primary px-3 py-1.5 font-display text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
                        >
                          Publish reply
                        </button>
                        <button
                          type="button"
                          disabled={decideReply.isPending}
                          onClick={() =>
                            decideReply.mutate({ id: review.reply!.id, status: "rejected" })
                          }
                          className="rounded-sm border border-border-strong px-3 py-1.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                        >
                          Reject reply
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="rounded-sm border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {LABEL[review.status]}
                  </span>
                  {(review.status !== "published" || review.reported_at) && (
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: review.id, status: "published" })}
                      className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                    >
                      {review.reported_at && review.status === "published"
                        ? "Keep published"
                        : "Publish"}
                    </button>
                  )}
                  {review.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: review.id, status: "rejected" })}
                      className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      {review.status === "published" ? "Take down" : "Reject"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
