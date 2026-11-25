import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Star } from "lucide-react";
import { RATING_FIELDS } from "@/lib/after-job.shared";
import {
  listMyReviews,
  replyToMyReview,
  reportMyReview,
  type FirmReview,
} from "@/lib/reviews.functions";

const card = "rounded-md border border-border bg-card p-6";
const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

/** The firm's Reviews tab: published reviews, one reply each, and a report route. */
export function FirmReviews() {
  const list = useServerFn(listMyReviews);
  const reviews = useQuery({ queryKey: ["my-firm-reviews"], queryFn: () => list({}) });

  if (reviews.isPending) return <p className="text-muted-foreground">Loading your reviews…</p>;
  if (reviews.isError)
    return (
      <p role="alert" className="text-muted-foreground">
        {reviews.error.message}
      </p>
    );
  if (reviews.data.length === 0)
    return (
      <div className={`${card} max-w-2xl`}>
        <h2 className="text-xl">No reviews yet</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A homeowner can review you after they accept your quote and tell us the work is complete.
          We check each review before it appears here and on your profile. You can reply to each one
          once, and report one you believe breaks the review rules.
        </p>
      </div>
    );
  return (
    <ul className="grid gap-4">
      {reviews.data.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </ul>
  );
}

function ReviewRow({ review }: { review: FirmReview }) {
  const queryClient = useQueryClient();
  const reply = useServerFn(replyToMyReview);
  const report = useServerFn(reportMyReview);
  const [mode, setMode] = useState<"none" | "reply" | "report">("none");
  const [text, setText] = useState("");
  const done = async (message: string) => {
    toast.success(message);
    setMode("none");
    setText("");
    await queryClient.invalidateQueries({ queryKey: ["my-firm-reviews"] });
  };
  const sendReply = useMutation({
    mutationFn: () => reply({ data: { reviewId: review.id, body: text } }),
    onSuccess: () => done("Reply sent. We'll check it before it appears."),
    onError: (e: Error) => toast.error(e.message),
  });
  const sendReport = useMutation({
    mutationFn: () => report({ data: { reviewId: review.id, reason: text } }),
    onSuccess: () => done("Report sent. We'll look at it and tell you what we decide."),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">{review.title || "Customer review"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {review.author_name}
            {review.job_type ? ` · ${review.job_type}` : ""} ·{" "}
            {new Date(review.created_at).toLocaleDateString("en-GB")}
            {review.verified_job ? (
              <span className="ml-2 inline-flex items-center gap-1 text-foreground">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Verified job
              </span>
            ) : null}
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

      {review.reply ? (
        <div className="mt-5 border-l-2 border-primary pl-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your reply ·{" "}
            {review.reply.status === "published"
              ? "published"
              : review.reply.status === "rejected"
                ? "not published"
                : "being checked"}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {review.reply.body}
          </p>
        </div>
      ) : null}
      {review.reported ? (
        <p className="mt-4 text-sm text-muted-foreground">
          You have reported this review. It stays published while we decide.
        </p>
      ) : null}

      {mode === "none" ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {!review.reply && (
            <button
              type="button"
              onClick={() => setMode("reply")}
              className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Reply publicly
            </button>
          )}
          {!review.reported && (
            <button
              type="button"
              onClick={() => setMode("report")}
              className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Report this review
            </button>
          )}
        </div>
      ) : (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "reply") sendReply.mutate();
            else sendReport.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">
              {mode === "reply"
                ? "Your public reply (you can reply once)"
                : "Which review rule do you think this breaks, and why?"}
            </span>
            <textarea
              required
              rows={4}
              maxLength={mode === "reply" ? 1500 : 1000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={field}
            />
          </label>
          {mode === "report" && (
            <p className="mt-2 text-sm text-muted-foreground">
              We remove a review only if it doesn't relate to the job, contains personal details or
              abuse, or isn't from the real customer. A low score alone is not a reason.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={sendReply.isPending || sendReport.isPending}
              className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
            >
              {mode === "reply" ? "Send reply" : "Send report"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("none");
                setText("");
              }}
              className="rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
