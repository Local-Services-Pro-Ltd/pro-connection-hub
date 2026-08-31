import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Section } from "@/components/layout-bits";
import { AiAnswer } from "@/components/ai-answer";

import { questionQuery } from "@/lib/queries";
import { submitAnswer } from "@/lib/qa.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/ask/$id")({
  loader: async ({ params, context }) =>
    context.queryClient.ensureQueryData(questionQuery(params.id)),
  head: ({ params, loaderData }) => {
    const q = loaderData?.question ?? null;
    const answers = (loaderData?.answers ?? []).filter((a) => a.status === "published");
    const url = `https://tradesmanfinder.org/ask/${params.id}`;
    const title = q
      ? `${q.title.slice(0, 70)} | Ask the pros | TradesmanFinder`
      : "Question and answers | Ask the pros | TradesmanFinder";
    const description = q
      ? `${q.body ?? q.title}`.replace(/\s+/g, " ").slice(0, 155)
      : "A homeowner's question answered by vetted UK tradesmen on TradesmanFinder.";
    const scripts = q
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "QAPage",
              mainEntity: {
                "@type": "Question",
                name: q.title,
                text: q.body ?? q.title,
                answerCount: answers.length,
                datePublished: q.created_at,
                author: { "@type": "Person", name: q.asker_name || "Homeowner" },
                ...(answers.length
                  ? {
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: answers[0]!.body,
                        datePublished: answers[0]!.created_at,
                        url,
                        author: {
                          "@type": "Person",
                          name: answers[0]!.author_name || "Vetted tradesman",
                        },
                      },
                      suggestedAnswer: answers.slice(1).map((a) => ({
                        "@type": "Answer",
                        text: a.body,
                        datePublished: a.created_at,
                        url,
                        author: {
                          "@type": "Person",
                          name: a.author_name || "Vetted tradesman",
                        },
                      })),
                    }
                  : {}),
              },
            }),
          },
        ]
      : [];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: QuestionPage,
});


const input =
  "w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function QuestionPage() {
  const { id } = Route.useParams();
  const { data, refetch } = useQuery(questionQuery(id));
  const { user } = useAuth();
  const answer = useServerFn(submitAnswer);
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => answer({ data: { questionId: id, body } }),
    onSuccess: () => {
      setSent(true);
      setBody("");
      void refetch();
    },
  });

  const question = data?.question;
  const answers = data?.answers ?? [];

  if (data && !question) {
    return (
      <Section>
        <h1 className="text-3xl">That question isn't available</h1>
        <Link to="/ask" className="mt-4 inline-block text-primary hover:underline">
          Browse all questions
        </Link>
      </Section>
    );
  }

  return (
    <Section>
      <Link to="/ask" className="eyebrow hover:text-primary">
        ← Ask the pros
      </Link>

      <h1 className="mt-4 max-w-3xl text-3xl leading-tight sm:text-4xl">
        {question?.title ?? "Loading…"}
      </h1>
      {question && (
        <p className="mt-3 text-sm text-muted-foreground">
          Asked by {question.asker_name}
          {question.area ? ` in ${question.area}` : ""}
        </p>
      )}
      {question && (
        <p className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">
          {question.body}
        </p>
      )}

      <h2 className="mt-12 border-t border-border pt-10 font-display text-2xl">
        {answers.length} answer{answers.length === 1 ? "" : "s"} from vetted
        firms
      </h2>

      <ul className="mt-6 grid max-w-3xl gap-4">
        {answers.map((a) => (
          <li key={a.id} className="rounded-md border border-border bg-card p-6">
            <p className="eyebrow">{a.author_name}</p>
            <p className="mt-3 whitespace-pre-line leading-relaxed">{a.body}</p>
          </li>
        ))}
      </ul>

      {answers.length === 0 && (
        <p className="mt-6 max-w-3xl rounded-md border border-border bg-card p-6 text-muted-foreground">
          No published answers yet. Vetted firms are notified of new questions —
          check back shortly, or{" "}
          <Link to="/post-job" search={{}} className="text-primary hover:underline">
            post the job
          </Link>{" "}
          if you'd rather get quotes.
        </p>
      )}

      {question?.ai_answer && (
        <div className="mt-6 max-w-3xl">
          <AiAnswer
            answer={question.ai_answer}
            safety={question.ai_safety}
            safetyNote={question.ai_safety_note}
            tags={question.ai_tags}
            urgency={question.ai_urgency}
          />
        </div>
      )}


      <div className="mt-12 max-w-3xl border-t border-border pt-10">
        <h2 className="font-display text-2xl">Answer this question</h2>
        {user ? (
          sent ? (
            <p role="status" className="mt-4 text-muted-foreground">
              Thanks — your answer is with our team for review and will appear
              once published.
            </p>
          ) : (
            <form
              className="mt-4 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <textarea
                required
                minLength={20}
                maxLength={4000}
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Answer plainly, as you would on the doorstep. No sales pitches — they aren't published."
                className={input}
              />
              {mutation.error && (
                <p role="alert" className="text-sm text-destructive">
                  {(mutation.error as Error).message}
                </p>
              )}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-fit rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
              >
                {mutation.isPending ? "Sending…" : "Post answer"}
              </button>
            </form>
          )
        ) : (
          <p className="mt-4 text-muted-foreground">
            Answering is open to vetted firms on the network.{" "}
            <Link to="/signin" search={{}} className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link to="/for-tradesmen" className="text-primary hover:underline">
              join as a tradesman
            </Link>
            .
          </p>
        )}
      </div>
    </Section>
  );
}
