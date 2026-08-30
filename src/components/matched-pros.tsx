import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Star, Clock } from "lucide-react";
import { matchPros, type MatchedPro } from "@/lib/queries";
import { TrustBadge } from "@/components/trust-badge";
import pro1 from "@/assets/pro-1.jpg";
import pro2 from "@/assets/pro-2.jpg";
import pro3 from "@/assets/pro-3.jpg";

const photos: Record<number, string> = { 1: pro1, 2: pro2, 3: pro3 };

/** Three best-fit vetted pros, ranked server-side right after a job is posted. */
export function MatchedPros({
  trade,
  postcode,
  budget,
}: {
  trade: string;
  postcode?: string;
  budget?: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["matched-pros", trade, postcode, budget],
    queryFn: () => matchPros({ trade, postcode, budget }),
    enabled: Boolean(trade),
    staleTime: 60_000,
  });

  if (isPending)
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Matching vetted trades near you…
      </p>
    );
  if (isError || !data || data.length === 0)
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        We're hand-matching your job now — you'll hear from up to three vetted
        trades shortly.
      </p>
    );

  return (
    <div className="mt-8">
      <h3 className="text-xl">Your top {data.length} matches</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Ranked on verified credentials, reviews, reply speed and how close they
        are to you. Book a slot with any of them now.
      </p>
      <ul className="mt-5 grid gap-4">
        {data.map((m: MatchedPro, i) => (
          <li
            key={m.pro_id}
            className="flex gap-4 rounded-md border border-border bg-card p-4"
          >
            <img
              src={photos[m.photo] ?? pro1}
              alt={`${m.name} of ${m.company}`}
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded-sm object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Match #{i + 1}
                </span>
                <TrustBadge score={m.trust_score} />
              </div>
              <p className="mt-1.5 truncate font-display text-base">{m.company}</p>
              <p className="text-sm text-muted-foreground">
                {m.name} · {m.area}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  {m.review_count ? `${m.rating} (${m.review_count})` : "New"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />~{m.response_mins} min reply
                </span>
                <span>{m.reason}</span>
              </div>
              <Link
                to="/pro/$id"
                params={{ id: m.pro_id }}
                className="mt-3 inline-block rounded-sm border border-border-strong px-4 py-2 font-display text-xs font-semibold hover:border-primary hover:text-primary"
              >
                View profile & book a slot
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
