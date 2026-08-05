import { Link } from "@tanstack/react-router";
import { Star, Clock, ShieldCheck } from "lucide-react";
import type { Pro } from "@/lib/site-data";
import pro1 from "@/assets/pro-1.jpg";
import pro2 from "@/assets/pro-2.jpg";
import pro3 from "@/assets/pro-3.jpg";

const photos = { 1: pro1, 2: pro2, 3: pro3 };

export function ProCard({ pro }: { pro: Pro }) {
  return (
    <Link
      to="/pro/$id"
      params={{ id: pro.id }}
      className="lift group block overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={photos[pro.photo]}
          alt={`${pro.name}, ${pro.trade} in ${pro.area}`}
          loading="lazy"
          width={800}
          height={800}
          className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 font-display text-[11px] font-semibold uppercase tracking-widest text-primary backdrop-blur">
          {pro.trade}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-base">{pro.company}</h3>
          <span className="flex shrink-0 items-center gap-1 text-sm">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            {pro.rating}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {pro.name} · {pro.area} · {pro.reviews} reviews
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            {pro.verified[1]}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />~{pro.responseMins} min reply
          </span>
        </div>
      </div>
    </Link>
  );
}
