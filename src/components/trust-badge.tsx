import { ShieldCheck } from "lucide-react";

export type TrustTier = {
  label: string;
  tone: string;
  blurb: string;
};

export function trustTier(score: number): TrustTier {
  if (score >= 80)
    return {
      label: "Elite verified",
      tone: "text-success border-success/40 bg-success/10",
      blurb: "Fully checked, highly rated and quick to reply.",
    };
  if (score >= 65)
    return {
      label: "Trusted",
      tone: "text-success border-success/30 bg-success/5",
      blurb: "Checks verified with a strong review record.",
    };
  if (score >= 45)
    return {
      label: "Verified",
      tone: "text-primary border-primary/30 bg-primary/10",
      blurb: "Core credentials verified by our team.",
    };
  return {
    label: "New to the network",
    tone: "text-muted-foreground border-border-strong bg-surface",
    blurb: "Checks in progress — early days on TradesmanFinder.",
  };
}

/** Composite score: credentials verified + rating + reviews + years + reply speed. */
export function TrustBadge({
  score,
  size = "sm",
  className = "",
}: {
  score: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const tier = trustTier(score);
  return (
    <span
      title={`Trust score ${score}/100 — ${tier.blurb}`}
      className={`inline-flex items-center gap-1.5 rounded-sm border font-display font-semibold uppercase tracking-widest ${tier.tone} ${
        size === "lg" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]"
      } ${className}`}
    >
      <ShieldCheck className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {tier.label}
      <span className="opacity-70">{score}</span>
    </span>
  );
}

export function TrustBreakdown({
  score,
  verified,
  total,
  rating,
  reviews,
  years,
  responseMins,
}: {
  score: number;
  verified: number;
  total: number;
  rating: number;
  reviews: number;
  years: number;
  responseMins: number;
}) {
  const tier = trustTier(score);
  const rows = [
    { label: "Verified credentials", value: `${verified} of ${total || verified}` },
    { label: "Customer rating", value: reviews ? `${rating} from ${reviews} reviews` : "No reviews yet" },
    { label: "Years trading", value: `${years} years` },
    { label: "Typical reply", value: `~${responseMins} min` },
  ];
  return (
    <div className="rounded-md border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Trust score</p>
          <p className="mt-2 font-display text-3xl">
            {score}
            <span className="text-base text-muted-foreground">/100</span>
          </p>
        </div>
        <TrustBadge score={score} size="lg" />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{tier.blurb}</p>
      <dl className="mt-5 grid gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
