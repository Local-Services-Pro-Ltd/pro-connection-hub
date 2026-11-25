import { Link } from "@tanstack/react-router";
import { Star, Quote, ShieldCheck } from "lucide-react";
import type { PublicReview } from "@/lib/queries";

export function ReviewPanel({ reviews }: { reviews: PublicReview[] }) {
  return (
    <>
      <div className="mt-12 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl">Reviews</h2>
        <span className="text-sm text-muted-foreground">{reviews.length} published</span>
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-5 grid gap-px overflow-hidden rounded-md border border-border bg-border">
          {reviews.map((r) => (
            <li key={r.id} className="bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Quote className="h-4 w-4 text-primary" />
                  <h3 className="text-base">{r.title || "Customer review"}</h3>
                </div>
                <span className="flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  {r.rating}
                </span>
              </div>
              <p className="mt-3 leading-relaxed text-muted-foreground">{r.body}</p>
              <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
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
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-md border border-border bg-card p-6">
          <p className="font-display text-base">No reviews yet</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Reviews will only come from customers who've had work done through TradesmanFinder. This
            firm hasn't been reviewed here yet.
          </p>
        </div>
      )}

      <div className="mt-8 rounded-md border border-border bg-surface p-6">
        <p className="eyebrow">How reviews work</p>
        <h3 className="mt-2 text-xl">Reviews come from jobs, not from anyone passing by</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A review can only be left by a homeowner whose job on TradesmanFinder this firm quoted
          for. We check each one before it is published, and a low score is never a reason to reject
          it. We are still building the step that asks homeowners for their review, so no reviews
          can be left just yet.
        </p>
        <Link to="/verification" className="mt-4 inline-flex text-sm text-primary hover:underline">
          How we check firms
        </Link>
      </div>
    </>
  );
}
