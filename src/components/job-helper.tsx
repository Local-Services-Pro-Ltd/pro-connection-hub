import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";
import { costGuide, hasCostGuide, rateLabel, rateRange } from "@/lib/cost-guides";
import { helpWriteJob } from "@/lib/job-helper.functions";
import type { JobSuggestion } from "@/lib/job-helper.types";
import type { Trade } from "@/lib/queries";

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary";

export function JobHelper({
  trades,
  onUse,
}: {
  trades: Trade[];
  onUse: (suggestion: JobSuggestion) => void;
}) {
  const [text, setText] = useState("");
  const help = useServerFn(helpWriteJob);
  const mutation = useMutation({
    mutationFn: async () => help({ data: { text } }),
  });

  const suggestion =
    mutation.data && "suggestion" in mutation.data ? mutation.data.suggestion : null;
  const errorCode = mutation.data && "error" in mutation.data ? mutation.data.error : null;

  if (suggestion) {
    const trade = trades.find((item) => item.slug === suggestion.trade_slug);
    const guide =
      suggestion.trade_slug && hasCostGuide(suggestion.trade_slug)
        ? costGuide(suggestion.trade_slug)
        : undefined;

    return (
      <section
        aria-label="AI job suggestion"
        className="rounded-md border border-dashed border-border-strong bg-surface p-6 lg:p-8"
      >
        <p className="inline-flex items-center gap-2 eyebrow">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Suggested by AI — check it before posting
        </p>
        <p className="mt-5 text-sm text-muted-foreground">
          Suggested trade: <strong className="text-foreground">{trade?.name ?? "Not sure"}</strong>
        </p>
        <h2 className="mt-3 font-display text-2xl">{suggestion.title}</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
          {suggestion.description}
        </p>

        {suggestion.questions_to_add.length > 0 && (
          <div className="mt-5">
            <h3 className="font-display text-sm font-semibold">Adding these helps firms quote</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {suggestion.questions_to_add.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        )}

        {suggestion.safety_note && (
          <p
            role="alert"
            className="mt-5 flex gap-3 rounded-sm border border-primary/40 bg-primary/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{suggestion.safety_note}</span>
          </p>
        )}

        {guide && suggestion.trade_slug && (
          <div className="mt-5 rounded-sm border border-border bg-card p-4 text-sm">
            <p className="font-display font-semibold">
              {rateLabel(guide)}: {rateRange(guide)}
            </p>
            <p className="mt-1 text-muted-foreground">
              Typical UK range from our cost guide — your quote may differ
            </p>
            <Link
              to="/costs/$trade"
              params={{ trade: suggestion.trade_slug }}
              className="mt-2 inline-block font-medium text-primary underline underline-offset-4"
            >
              See the cost guide
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onUse(suggestion)}
            className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Use this
          </button>
          <button
            type="button"
            onClick={() => {
              setText("");
              mutation.reset();
            }}
            className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Start again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-surface p-6 lg:p-8">
      <label htmlFor="job-helper-text" className="eyebrow">
        Describe the problem in your own words
      </label>
      <textarea
        id="job-helper-text"
        rows={5}
        minLength={20}
        maxLength={1000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="For example: water is dripping under the kitchen sink, especially when the tap is running."
        className={`${field} mt-3 resize-y`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{text.trim().length}/1000</span>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-2 rounded-sm border border-border-strong bg-card px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {mutation.isPending ? "Writing…" : "Help me write this job"}
        </button>
      </div>
      {(errorCode || mutation.error) && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {mutation.error
            ? (mutation.error as Error).message
            : errorCode === "rate_limited"
              ? "You've used the helper a few times — please try again in an hour."
              : "The helper isn't available right now — you can fill in the form yourself."}
        </p>
      )}
    </section>
  );
}
