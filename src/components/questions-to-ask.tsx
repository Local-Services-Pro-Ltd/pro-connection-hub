import { questionsFor } from "@/lib/questions-to-ask";

/** A short checklist a homeowner can use when talking to firms and comparing quotes. */
export function QuestionsToAsk({ tradeSlug, trade }: { tradeSlug: string; trade?: string }) {
  const { general, trade: specific } = questionsFor(tradeSlug);
  return (
    <details className="mt-12 rounded-md border border-border bg-card p-6">
      <summary className="cursor-pointer font-display text-xl">Questions to ask each firm</summary>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        Asking every firm the same questions makes their answers, and their quotes, easier to
        compare. Get the important answers in writing.
      </p>
      {specific.length > 0 && (
        <>
          <h3 className="mt-5 text-base">
            For {trade ? trade.toLowerCase() : "this kind of"} work
          </h3>
          <ul className="mt-2 grid list-disc gap-2 pl-5 text-sm text-muted-foreground">
            {specific.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </>
      )}
      <h3 className="mt-5 text-base">For any job</h3>
      <ul className="mt-2 grid list-disc gap-2 pl-5 text-sm text-muted-foreground">
        {general.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </details>
  );
}
