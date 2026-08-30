import { AlertTriangle, Sparkles } from "lucide-react";

type Props = {
  answer: string | null | undefined;
  safety?: string | null;
  safetyNote?: string | null;
  tags?: string[] | null;
  urgency?: string | null;
  compact?: boolean;
};

/**
 * Clearly-labelled AI first pass. It always sits below vetted pro answers —
 * it is a starting point, never the authoritative answer.
 */
export function AiAnswer({
  answer,
  safety,
  safetyNote,
  tags,
  urgency,
  compact,
}: Props) {
  if (!answer) return null;
  const high = safety === "high";

  return (
    <div
      className={`rounded-md border border-dashed border-border-strong bg-surface ${compact ? "p-5" : "p-6"}`}
    >
      <p className="inline-flex items-center gap-2 eyebrow">
        <Sparkles className="h-4 w-4 text-primary" />
        AI first pass — not a vetted tradesman
      </p>

      {high && (
        <p
          role="alert"
          className="mt-4 flex gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <strong>Get a qualified pro — don't DIY this.</strong>{" "}
            {safetyNote ??
              "Gas, mains electrical, structural and asbestos work must be carried out by a registered professional."}
          </span>
        </p>
      )}

      {!high && safetyNote && (
        <p className="mt-4 rounded-sm border border-border bg-card p-4 text-sm text-muted-foreground">
          {safetyNote}
        </p>
      )}

      <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">
        {answer}
      </p>

      {(tags?.length || urgency) && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {urgency && (
            <li className="rounded-full border border-border px-3 py-1 text-xs capitalize text-muted-foreground">
              {urgency}
            </li>
          )}
          {(tags ?? []).map((t) => (
            <li
              key={t}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Generated automatically from the question. Always confirm with a vetted
        firm before starting work.
      </p>
    </div>
  );
}
