import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Lock, X } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { isAdminQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { listPendingQa, moderateQa } from "@/lib/qa.functions";

export const Route = createFileRoute("/admin/qa")({
  head: () => ({
    meta: [
      { title: "Q&A moderation — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Review, publish or reject homeowner questions and tradesman answers before they go live.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  component: AdminQa,
});

function AdminQa() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending: checkingRole } = useQuery({
    ...isAdminQuery(user?.id),
    enabled: !loading,
  });
  const load = useServerFn(listPendingQa);
  const moderate = useServerFn(moderateQa);

  const { data, refetch } = useQuery({
    queryKey: ["admin-qa"],
    queryFn: () => load(),
    enabled: isAdmin === true,
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      target: "question" | "answer";
      id: string;
      status: "published" | "rejected";
    }) => moderate({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.status === "published" ? "Published." : "Rejected — kept private.",
      );
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || (user && checkingRole))
    return <Section>Checking access…</Section>;

  if (!isAdmin) {
    return (
      <Section>
        <p className="inline-flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" /> Admins only.
        </p>
      </Section>
    );
  }

  const questions = data?.questions ?? [];
  const answers = data?.answers ?? [];
  const reviews = data?.reviews ?? [];
  const reviewFor = (id: string) => reviews.find((r) => r.question_id === id);
  const questionTitle = (id: string) =>
    questions.find((q) => q.id === id)?.title ?? "Question";


  const Actions = ({
    target,
    id,
  }: {
    target: "question" | "answer";
    id: string;
  }) => (
    <div className="mt-4 flex gap-2">
      <button
        onClick={() => mutation.mutate({ target, id, status: "published" })}
        className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:brightness-110"
      >
        <Check className="h-4 w-4" /> Publish
      </button>
      <button
        onClick={() => mutation.mutate({ target, id, status: "rejected" })}
        className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-destructive hover:text-destructive"
      >
        <X className="h-4 w-4" /> Reject
      </button>
    </div>
  );

  return (
    <Section>
      <SectionHead
        eyebrow="Moderation"
        title="Ask the pros — review queue"
        sub="Nothing appears on the public site until it's published here. Reject anything with personal details, abuse or a sales pitch."
      />

      <h2 className="mt-12 font-display text-2xl">
        Questions ({questions.filter((q) => q.status === "pending").length}{" "}
        pending)
      </h2>
      <ul className="mt-6 grid gap-4">
        {questions.map((q) => (
          <li key={q.id} className="rounded-md border border-border bg-card p-6">
            <p className="eyebrow">
              {q.status} · {q.trade_slug ?? "general"} · {q.asker_name}
              {q.area ? ` · ${q.area}` : ""}
            </p>
            <h3 className="mt-2 font-display text-lg">{q.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {q.body}
            </p>

            {(() => {
              const r = reviewFor(q.id);
              if (!r) return null;
              const tone =
                r.verdict === "reject"
                  ? "border-destructive/40 text-destructive"
                  : r.verdict === "publish"
                    ? "border-border-strong"
                    : "border-border";
              return (
                <div className={`mt-4 rounded-sm border ${tone} bg-surface p-4`}>
                  <p className="eyebrow">
                    AI suggests: {r.verdict} · {r.risk} risk
                    {q.ai_safety && q.ai_safety !== "none"
                      ? ` · ${q.ai_safety} safety`
                      : ""}
                    {q.ai_urgency ? ` · ${q.ai_urgency}` : ""}
                  </p>
                  {r.summary && <p className="mt-2 text-sm">{r.summary}</p>}
                  {r.reasons.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                      {r.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {(q.ai_tags ?? []).length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tags: {(q.ai_tags ?? []).join(", ")}
                      {q.ai_suggested_trade
                        ? ` · suggested trade: ${q.ai_suggested_trade}`
                        : ""}
                    </p>
                  )}
                  {q.ai_answer && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        AI first-pass answer shown to the homeowner
                      </summary>
                      <p className="mt-2 whitespace-pre-line">{q.ai_answer}</p>
                    </details>
                  )}
                </div>
              );
            })()}

            <Actions target="question" id={q.id} />

          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-2xl">
        Answers ({answers.filter((a) => a.status === "pending").length} pending)
      </h2>
      <ul className="mt-6 grid gap-4">
        {answers.map((a) => (
          <li key={a.id} className="rounded-md border border-border bg-card p-6">
            <p className="eyebrow">
              {a.status} · {a.author_name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              On: {questionTitle(a.question_id)}
            </p>
            <p className="mt-3 whitespace-pre-line text-sm">{a.body}</p>
            <Actions target="answer" id={a.id} />
          </li>
        ))}
      </ul>

      {questions.length === 0 && answers.length === 0 && (
        <p className="mt-8 text-muted-foreground">Nothing to review.</p>
      )}
    </Section>
  );
}
