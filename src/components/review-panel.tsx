import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Quote, Star } from "lucide-react";
import { listReviewDetails } from "@/lib/after-job.functions";
import { RATING_FIELDS } from "@/lib/after-job.shared";
import type { PublicReview } from "@/lib/queries";

export function ReviewPanel({ proId, reviews }: { proId: string; reviews: PublicReview[] }) {
  // Sub-ratings, the verified-job flag and the firm's reply for published reviews.
  const details = useQuery({
    queryKey: ["review-details", proId],
    queryFn: () => listReviewDetails({ data: { proId } }),
    enabled: reviews.length > 0,
    staleTime: 60_000,
  });
  const detailBy = new Map((details.data ?? []).map((detail) => [detail.id, detail]));

  return (
    <>
      <div className="mt-12 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl">Reviews</h2>
        <span className="text-sm text-muted-foreground">{reviews.length} published</span>
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
          {reviews.map((r) => {
            const detail = r.id ? detailBy.get(r.id) : undefined;
            return (
              <li key={r.id} className="bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Quote className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="text-base">{r.title || "Customer review"}</h3>
                  </div>
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
                    {r.rating} out of 5
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                  {r.body}
                </p>
                {detail && Object.keys(detail.ratings).length > 0 && (
                  <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {RATING_FIELDS.filter((field) => detail.ratings[field.key]).map((field) => (
                      <div key={field.key} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{field.label}</dt>
                        <dd>{detail.ratings[field.key]} / 5</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  {detail?.verified_job ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 font-semibold text-foreground">
                      <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Verified job
                    </span>
                  ) : null}
                  <span className="text-foreground">{r.author_name}</span>
                  {r.job_type ? `· ${r.job_type}` : ""}
                  <span>
                    ·{" "}
                    {new Date(r.created_at ?? "").toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </p>
                {detail?.reply ? (
                  <div className="mt-4 border-l-2 border-primary pl-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Reply from the firm
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {detail.reply}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 rounded-md border border-border bg-card p-6">
          <p className="font-display text-base">No reviews yet</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This firm hasn't completed a job through TradesmanFinder that has been reviewed yet.
          </p>
        </div>
      )}

      <div className="mt-8 rounded-md border border-border bg-surface p-6">
        <p className="eyebrow">How reviews work</p>
        <h3 className="mt-2 text-xl">Reviews come from jobs, not from anyone passing by</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A review can only be left by the homeowner of a job on TradesmanFinder, for the firm they
          chose, once they have told us the work is complete. That is what "Verified job" means. We
          check each review before it is published, a low score is never a reason to reject one, and
          firms cannot pay to remove or reorder reviews.
        </p>
        <Link
          to="/verification"
          hash="reviews"
          className="mt-4 inline-flex text-sm text-primary hover:underline"
        >
          Our review rules
        </Link>
      </div>
    </>
  );
}
