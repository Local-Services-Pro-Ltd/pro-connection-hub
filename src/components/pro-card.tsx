import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { type Pro } from "@/lib/queries";
import { SaveProButton } from "@/components/save-pro-button";
import pro1 from "@/assets/pro-1.jpg";
import pro2 from "@/assets/pro-2.jpg";
import pro3 from "@/assets/pro-3.jpg";

const photos: Record<number, string> = { 1: pro1, 2: pro2, 3: pro3 };

export function ProCard({ pro }: { pro: Pro }) {
  const hasReviews = pro.review_count > 0;

  return (
    <Link
      to="/pro/$id"
      params={{ id: pro.id }}
      className="lift group block overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={photos[pro.photo] ?? pro1}
          alt={`${pro.name}, ${pro.trade_slug.replace("-", " ")} in ${pro.area}`}
          loading="lazy"
          width={800}
          height={800}
          className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 font-display text-[11px] font-semibold uppercase tracking-widest text-primary capitalize backdrop-blur">
          {pro.trade_slug.replace("-", " ")}
        </span>
        <SaveProButton
          proId={pro.id}
          company={pro.company}
          className="absolute bottom-3 right-3"
        />
        <span className="absolute right-3 top-3 rounded-sm bg-muted px-2 py-1 font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {pro.is_demo ? "Example listing" : "Vetting in progress"}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-base">{pro.company}</h3>
          {hasReviews ? (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {pro.rating}
            </span>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">New</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {pro.name} · {pro.area}
          {hasReviews
            ? ` · ${pro.review_count} review${pro.review_count === 1 ? "" : "s"}`
            : ""}
        </p>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          ID and insurance checks must be completed before this firm can quote.
        </p>
      </div>
    </Link>
  );
}
