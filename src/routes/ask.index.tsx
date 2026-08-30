import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessagesSquare } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import { AiAnswer } from "@/components/ai-answer";
import { tradesQuery, questionsQuery, relatedQuestionsQuery } from "@/lib/queries";
import { submitQuestion } from "@/lib/qa.functions";


export const Route = createFileRoute("/ask/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tradesQuery);
  },
  head: () => {
    const title = "Ask a tradesman — free advice from vetted UK pros";
    const description =
      "Stuck on a job? Ask a question and get answers from vetted UK tradesmen. Browse real questions on plumbing, electrics, roofing, damp and renovation costs.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: AskIndex,
});

const input =
  "w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function AskIndex() {
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const [filter, setFilter] = useState("");
  const { data: questions, refetch } = useQuery(questionsQuery(filter || undefined));

  const ask = useServerFn(submitQuestion);
  const check = useHumanCheck();
  const [form, setForm] = useState({
    title: "",
    body: "",
    trade: "",
    name: "",
    area: "",
  });
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () =>
      ask({
        data: {
          ...form,
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          website: check.state.website,
        },
      }),
    onSuccess: () => {
      setDone(true);
      setForm({ title: "", body: "", trade: "", name: "", area: "" });
      check.refresh();
      void refetch();
    },
    onError: () => check.refresh(),
  });

  const tradeName = useMemo(
    () => (slug: string | null) =>
      trades.find((t) => t.slug === slug)?.name ?? "General",
    [trades],
  );

  return (
    <Section>
      <SectionHead
        eyebrow="Ask the pros"
        title="Free advice from vetted UK tradesmen."
        sub="Describe the problem, and vetted firms on the network answer. Every question and answer is checked by us before it appears — no sales pitches, no anonymous noise."
      />

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="eyebrow">Filter by trade</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`${input} max-w-xs`}
            >
              <option value="">All trades</option>
              {trades.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <ul className="mt-8 grid gap-4">
            {(questions ?? []).map((q) => (
              <li key={q.id}>
                <Link
                  to="/ask/$id"
                  params={{ id: q.id }}
                  className="lift block rounded-md border border-border bg-card p-6"
                >
                  <p className="eyebrow">
                    {tradeName(q.trade_slug)}
                    {q.area ? ` · ${q.area}` : ""}
                  </p>
                  <h2 className="mt-2 font-display text-xl leading-snug">
                    {q.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {q.body}
                  </p>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
                    <MessagesSquare className="h-4 w-4" />
                    {Number(q.answer_count)} answer
                    {Number(q.answer_count) === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {(questions ?? []).length === 0 && (
            <p className="mt-8 rounded-md border border-border bg-card p-8 text-muted-foreground">
              No published questions here yet — yours could be the first.
            </p>
          )}
        </div>

        <div className="h-fit rounded-md border border-border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl">Ask your question</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It's free, and you don't need an account. We publish it once it's
            been checked — usually within a working day.
          </p>

          {done ? (
            <p
              role="status"
              className="mt-6 rounded-sm border border-border bg-surface p-4 text-sm"
            >
              Thanks — your question is with our team for review. It'll appear
              here once published, and vetted firms can answer from then on.
            </p>
          ) : (
            <form
              className="mt-6 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <label className="block">
                <span className="eyebrow">Your question</span>
                <input
                  required
                  minLength={10}
                  maxLength={160}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Why does my boiler lose pressure overnight?"
                  className={`${input} mt-2`}
                />
              </label>

              <label className="block">
                <span className="eyebrow">Detail</span>
                <textarea
                  required
                  minLength={20}
                  maxLength={4000}
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="What's happening, what you've already tried, and anything a tradesman would need to know."
                  className={`${input} mt-2`}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Trade</span>
                  <select
                    value={form.trade}
                    onChange={(e) => setForm({ ...form, trade: e.target.value })}
                    className={`${input} mt-2`}
                  >
                    <option value="">Not sure</option>
                    {trades.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Area (optional)</span>
                  <input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="Croydon"
                    className={`${input} mt-2`}
                  />
                </label>
              </div>

              <label className="block">
                <span className="eyebrow">Display name (optional)</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="A homeowner"
                  className={`${input} mt-2`}
                />
              </label>

              <HumanCheck {...check} inputClassName={input} />

              {mutation.error && (
                <p role="alert" className="text-sm text-destructive">
                  {(mutation.error as Error).message}
                </p>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
              >
                {mutation.isPending ? "Sending…" : "Ask the pros"}
              </button>
              <p className="text-xs text-muted-foreground">
                Don't include personal details — questions are public once
                published.
              </p>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}
