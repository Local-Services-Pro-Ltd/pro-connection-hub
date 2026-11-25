import { Link } from "@tanstack/react-router";
import { gbp, longDate, type QuoteView } from "@/lib/quotes.shared";

const ROWS: { label: string; value: (quote: QuoteView) => string }[] = [
  { label: "Labour", value: (q) => gbp(q.labour_pence) },
  { label: "Materials", value: (q) => gbp(q.materials_pence) },
  { label: "VAT", value: (q) => (q.vat_registered ? gbp(q.vat_pence) : "Not VAT registered") },
  { label: "Estimated start", value: (q) => longDate(q.start_date) || "Not stated" },
  {
    label: "Working days",
    value: (q) =>
      q.duration_days
        ? `${q.duration_days} ${q.duration_days === 1 ? "day" : "days"}`
        : "Not stated",
  },
  { label: "Warranty", value: (q) => q.warranty || "None stated" },
  { label: "Payment schedule", value: (q) => q.payment_schedule || "Not stated" },
  { label: "Not included", value: (q) => q.exclusions || "Nothing listed" },
  { label: "Could cost more if", value: (q) => q.possible_extras || "Nothing listed" },
  { label: "Valid until", value: (q) => longDate(q.expires_on) || "Not stated" },
];

/**
 * Quotes side by side: one card per firm, the same rows in the same order.
 * Cards stack on a phone and sit in up to three columns on a wide screen.
 */
export function QuoteCompare({
  quotes,
  busy,
  canDecide,
  onDecide,
}: {
  quotes: QuoteView[];
  busy: boolean;
  canDecide: boolean;
  onDecide: (quoteId: string, decision: "accept" | "decline") => void;
}) {
  const lowest = Math.min(...quotes.filter((q) => q.status === "sent").map((q) => q.total_pence));
  return (
    <>
      <ul className="mt-5 grid gap-4 lg:grid-cols-3">
        {quotes.map((quote) => (
          <li
            key={quote.id}
            className={`flex flex-col rounded-md border bg-card p-5 ${
              quote.status === "accepted" ? "border-primary" : "border-border"
            } ${quote.status === "declined" ? "opacity-70" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg">{quote.company}</h3>
              {quote.status === "accepted" ? (
                <span className="rounded-sm bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  Accepted
                </span>
              ) : quote.status === "declined" ? (
                <span className="rounded-sm border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Not chosen
                </span>
              ) : null}
            </div>
            <Link
              to="/pro/$id"
              params={{ id: quote.pro_id }}
              className="mt-1 text-sm text-primary hover:underline"
            >
              Profile and checks
            </Link>

            <p className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">
              Total{quote.vat_registered ? " including VAT" : ""}
            </p>
            <p className="mt-1 font-display text-3xl">{gbp(quote.total_pence)}</p>
            {quotes.length > 1 && quote.status === "sent" && quote.total_pence === lowest ? (
              <p className="mt-1 text-xs text-muted-foreground">Lowest total of these quotes</p>
            ) : null}

            <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm">
              {ROWS.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-line">{row.value(quote)}</dd>
                </div>
              ))}
            </dl>

            {quote.items.length > 0 && (
              <details className="mt-4 border-t border-border pt-4 text-sm">
                <summary className="cursor-pointer font-medium">Price breakdown</summary>
                <ul className="mt-3 grid gap-2 text-muted-foreground">
                  {quote.items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3">
                      <span>
                        {item.description}{" "}
                        <span className="text-xs">
                          ({item.kind === "labour" ? "labour" : "materials"})
                        </span>
                      </span>
                      <span className="shrink-0">{gbp(item.amount_pence)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {quote.notes ? (
              <p className="mt-4 whitespace-pre-line border-l-2 border-border pl-3 text-sm text-muted-foreground">
                {quote.notes}
              </p>
            ) : null}

            {canDecide && quote.status === "sent" && (
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(quote.id, "accept")}
                  className="rounded-sm bg-primary px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                >
                  Accept this quote
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(quote.id, "decline")}
                  className="rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        A quote is the firm's offer to you. Your agreement is with the firm, not with
        TradesmanFinder. Ask for it in writing before work starts, and don't choose on price alone:
        compare what is and isn't included.
      </p>
    </>
  );
}

const STEPS = ["Posted", "Quotes", "Firm chosen"] as const;

/** Where the job stands. Later steps (completed, reviewed) join in the next release. */
export function JobSteps({ step }: { step: 0 | 1 | 2 }) {
  return (
    <ol className="mt-8 flex flex-wrap gap-2" aria-label="Job progress">
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={index === step ? "step" : undefined}
          className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm ${
            index === step
              ? "bg-primary font-semibold text-primary-foreground"
              : index < step
                ? "bg-primary/15 text-foreground"
                : "border border-border text-muted-foreground"
          }`}
        >
          <span aria-hidden="true">{index + 1}</span>
          {label}
          <span className="sr-only">
            {index < step ? " (done)" : index === step ? " (current)" : " (to come)"}
          </span>
        </li>
      ))}
    </ol>
  );
}
