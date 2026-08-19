import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Quote, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { PublicReview } from "@/lib/queries";

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

export function ReviewPanel({
  proId,
  reviews,
}: {
  proId: string;
  reviews: PublicReview[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [jobType, setJobType] = useState("");
  const [place, setPlace] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to leave a review.");
      const trimmed = body.trim();
      if (trimmed.length < 20)
        throw new Error("Please write at least 20 characters.");
      const { error } = await supabase.from("reviews").insert({
        pro_id: proId,
        author_id: user.id,
        author_name:
          (user.user_metadata?.["full_name"] as string | undefined) ??
          user.email?.split("@")[0] ??
          "Customer",
        author_place: place.trim() || null,
        job_type: jobType.trim() || null,
        rating,
        title: title.trim().slice(0, 120),
        body: trimmed.slice(0, 2000),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setJobType("");
      setPlace("");
      setRating(5);
      queryClient.invalidateQueries({ queryKey: ["pro", proId] });
      toast.success("Review submitted — it'll appear once verified.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="mt-12 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl">Reviews</h2>
        <span className="text-sm text-muted-foreground">
          {reviews.length} published
        </span>
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
          {reviews.map((r) => (
            <li key={r.id} className="bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Quote className="h-4 w-4 text-primary" />
                  <h3 className="text-base">{r.title || "Verified job"}</h3>
                </div>
                <span className="flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  {r.rating}
                </span>
              </div>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {r.body}
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span className="text-foreground">{r.author_name}</span>
                {r.job_type ? `· ${r.job_type}` : ""}
                <span>
                  ·{" "}
                  {new Date(r.created_at).toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          No published reviews yet.
        </p>
      )}

      <div className="mt-8 rounded-md border border-border bg-surface p-6">
        <p className="eyebrow">Worked with them?</p>
        <h3 className="mt-2 text-xl">Leave a review</h3>

        {!user ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <Link to="/signin" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to write a review. We only publish reviews from signed-in accounts,
            and each one is checked before it goes live.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="mt-5 space-y-4"
          >
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => setRating(n)}
                  className="p-1"
                >
                  <Star
                    className={`h-6 w-6 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>

            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Summary — e.g. Bathroom refit, on time and tidy"
              className={field}
            />
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="What was the job, how did it go, would you use them again?"
              className={`${field} resize-y`}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                maxLength={80}
                placeholder="Job type (optional)"
                className={field}
              />
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                maxLength={80}
                placeholder="Your town (optional)"
                className={field}
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
            >
              {mutation.isPending ? "Submitting…" : "Submit review"}
            </button>
            <p className="text-xs text-muted-foreground">
              Reviews are moderated before publication and are linked to your
              account.
            </p>
          </form>
        )}
      </div>
    </>
  );
}
