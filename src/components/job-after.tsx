import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import {
  getJobAfter,
  markJobCompleted,
  reportJobProblem,
  submitJobReview,
} from "@/lib/after-job.functions";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUS_LABEL,
  RATING_FIELDS,
  type Ratings,
} from "@/lib/after-job.shared";

const card = "rounded-md border border-border bg-card p-6 sm:p-7";
const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const primary =
  "rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60";
const secondary =
  "rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60";

/** Everything a homeowner does after choosing a firm: complete, review, report. */
export function JobAfterPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const after = useQuery({
    queryKey: ["job-after", token],
    queryFn: () => getJobAfter({ data: { token } }),
    retry: false,
  });
  const [showProblem, setShowProblem] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["job-after", token] });
  const complete = useMutation({
    mutationFn: () => markJobCompleted({ data: { token } }),
    onSuccess: async () => {
      toast.success("Marked as completed. You can now review the firm.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!after.data?.chosen) return null;
  const { chosen, outcome, review, complaint } = after.data;

  return (
    <section className="mt-12" aria-labelledby="after-heading">
      <h2 id="after-heading" className="text-2xl">
        {outcome === "completed" ? "The work is finished" : "When the work is done"}
      </h2>

      {complaint && (
        <div className={`${card} mt-5`}>
          <p className="eyebrow">Your report · {complaint.reference}</p>
          <p className="mt-2 text-muted-foreground">
            Status: {COMPLAINT_STATUS_LABEL[complaint.status] ?? complaint.status}. We will email
            you what we find. To add anything, reply to our email and quote your reference.
          </p>
        </div>
      )}

      {outcome !== "completed" && (
        <div className={`${card} mt-5`}>
          <p className="max-w-2xl text-muted-foreground">
            Tell us when {chosen.company} has finished. That lets you leave a review, which helps
            the next homeowner and is the only way a review can be left here.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={complete.isPending}
              onClick={() => complete.mutate()}
              className={primary}
            >
              {complete.isPending ? "Saving…" : "The work is completed"}
            </button>
            {!complaint && (
              <button type="button" onClick={() => setShowProblem(true)} className={secondary}>
                Report a problem
              </button>
            )}
          </div>
        </div>
      )}

      {outcome === "completed" &&
        (review ? (
          <div className={`${card} mt-5`}>
            <p className="font-display text-lg">Thank you for your review</p>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {review.status === "published"
                ? `It is published on ${chosen.company}'s profile with a "Verified job" label.`
                : review.status === "rejected"
                  ? "We could not publish it because it did not meet our review rules. Email hello@tradesmanfinder.org if you would like to know why."
                  : "We check every review before it is published, usually within a few days. A low score is never a reason to reject one."}
            </p>
            <Link
              to="/pro/$id"
              params={{ id: chosen.pro_id }}
              className="mt-4 inline-flex text-sm text-primary hover:underline"
            >
              See {chosen.company}'s profile
            </Link>
          </div>
        ) : (
          <ReviewForm token={token} company={chosen.company} onDone={refresh} />
        ))}

      {outcome === "completed" && !complaint && !showProblem && (
        <button
          type="button"
          onClick={() => setShowProblem(true)}
          className="mt-5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Something went wrong? Report a problem
        </button>
      )}

      {showProblem && !complaint && (
        <ProblemForm
          token={token}
          company={chosen.company}
          onClose={() => setShowProblem(false)}
          onDone={async () => {
            setShowProblem(false);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function ReviewForm({
  token,
  company,
  onDone,
}: {
  token: string;
  company: string;
  onDone: () => void;
}) {
  const [ratings, setRatings] = useState<Partial<Ratings>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      submitJobReview({ data: { token, ratings: ratings as Ratings, title, body } }),
    onSuccess: () => {
      toast.success("Review sent. We'll check it and publish it.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className={`${card} mt-5`}
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <h3 className="text-xl">Review {company}</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Only you can review this job. We show your first name, never your surname or contact
        details. We check each review before publishing, and the firm may post one reply.
      </p>

      <div className="mt-6 grid gap-5">
        {RATING_FIELDS.map((item) => (
          <fieldset key={item.key}>
            <legend className="font-medium">{item.label}</legend>
            <p className="mt-1 text-sm text-muted-foreground">{item.prompt}</p>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} out of 5 for ${item.label}`}
                  aria-pressed={ratings[item.key] === n}
                  onClick={() => setRatings((current) => ({ ...current, [item.key]: n }))}
                  className="rounded-sm p-1.5 hover:bg-muted"
                >
                  <Star
                    className={`h-7 w-7 ${
                      n <= (ratings[item.key] ?? 0)
                        ? "fill-accent text-accent"
                        : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground" aria-live="polite">
                {ratings[item.key] ? `${ratings[item.key]} out of 5` : "Not rated yet"}
              </span>
            </div>
          </fieldset>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium">A short headline (optional)</span>
        <input
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          className={field}
        />
      </label>
      <label className="mt-5 block">
        <span className="text-sm font-medium">What was the job, and how did it go?</span>
        <textarea
          required
          rows={5}
          minLength={20}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className={field}
        />
      </label>
      <button type="submit" disabled={submit.isPending} className={`mt-6 ${primary}`}>
        {submit.isPending ? "Sending…" : "Send review"}
      </button>
    </form>
  );
}

function ProblemForm({
  token,
  company,
  onClose,
  onDone,
}: {
  token: string;
  company: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const submit = useMutation({
    mutationFn: () => reportJobProblem({ data: { token, category, description, desiredOutcome } }),
    onSuccess: (result) => {
      toast.success(`Report received. Your reference is ${result.reference}.`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className={`${card} mt-5`}
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <h3 className="text-xl">Report a problem with {company}</h3>
      <div className="mt-3 max-w-2xl space-y-2 text-sm text-muted-foreground">
        <p>
          We will share what you write with the firm and ask it to respond within 5 working days,
          then tell you what we find.
        </p>
        <p>
          We can record the problem, warn the firm, suspend it or remove it from TradesmanFinder. We
          cannot make a firm redo work or refund you, and we do not guarantee any job.{" "}
          <Link to="/complaints" className="text-primary hover:underline">
            How we handle complaints
          </Link>
        </p>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">What went wrong?</legend>
        <div className="mt-3 grid gap-2">
          {COMPLAINT_CATEGORIES.map((item) => (
            <label key={item.value} className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="category"
                required
                value={item.value}
                checked={category === item.value}
                onChange={() => setCategory(item.value)}
                className="mt-1"
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 block">
        <span className="text-sm font-medium">What happened?</span>
        <textarea
          required
          rows={5}
          minLength={20}
          maxLength={4000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Dates, what was agreed and what was done help us most."
          className={field}
        />
      </label>
      <label className="mt-5 block">
        <span className="text-sm font-medium">What would you like to happen? (optional)</span>
        <textarea
          rows={3}
          maxLength={1500}
          value={desiredOutcome}
          onChange={(event) => setDesiredOutcome(event.target.value)}
          className={field}
        />
      </label>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={submit.isPending} className={primary}>
          {submit.isPending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={onClose} className={secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
