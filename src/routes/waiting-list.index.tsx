import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Section } from "@/components/layout-bits";
import { useServerFn } from "@tanstack/react-start";
import { submitWaitingList } from "@/lib/waiting-list.functions";
import { HumanCheck, useHumanCheck } from "@/components/human-check";

const SITE = "https://tradesmanfinder.org";

type Search = { postcode?: string; role?: "homeowner" | "trader" };

export const Route = createFileRoute("/waiting-list/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["postcode"] === "string" && search["postcode"]
      ? { postcode: search["postcode"] }
      : {}),
    ...(search["role"] === "homeowner" || search["role"] === "trader"
      ? { role: search["role"] as "homeowner" | "trader" }
      : {}),
  }),
  head: () => {
    const description =
      "We're live in Greater London, Kent and Surrey. Tell us your postcode and we'll invite you the moment TradesmanFinder opens in your area.";
    return {
      meta: [
        { title: "Join the waiting list | TradesmanFinder" },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "Join the TradesmanFinder waiting list",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "Join the TradesmanFinder waiting list",
        },
        { name: "twitter:description", content: description },
        { property: "og:url", content: `${SITE}/waiting-list` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/waiting-list` }],
    };
  },
  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  notFoundComponent: () => (
    <Section>
      <p className="text-muted-foreground">Not found.</p>
    </Section>
  ),
  component: WaitingList,
});

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

type Role = "homeowner" | "trader";

function WaitingList() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState(
    (search.postcode ?? "").toUpperCase(),
  );
  const [role, setRole] = useState<Role>(search.role ?? "homeowner");
  const [trade, setTrade] = useState("");

  const submit = useServerFn(submitWaitingList);
  const check = useHumanCheck();

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          email,
          postcode,
          role,
          ...(role === "trader" && trade ? { trade } : {}),
          source: search.postcode ? "post_job_gate" : "waiting_list_page",
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          website: check.state.website,
        },
      }),
    onSuccess: (result) => {
      navigate({
        to: "/waiting-list/thanks",
        search: {
          area: result.area,
          ...(result.pending ? { pending: true } : {}),
          ...(result.waiting ? { waiting: result.waiting } : {}),
        },
      });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      check.refresh();
    },
  });

  return (
    <Section>
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">Waiting list</p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Tell us where you are.
        </h1>
        <p className="mt-4 text-muted-foreground">
          We're live in Greater London, Kent and Surrey. Drop your postcode and
          we'll invite you the moment your area goes live — the more sign-ups in
          a postcode, the sooner we open it.
        </p>

        <form
          className="mt-10 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <fieldset>
            <legend className="text-sm font-medium">I'm a</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(["homeowner", "trader"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className={`rounded-sm border px-4 py-3 text-sm font-medium transition-colors ${
                    role === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border-strong"
                  }`}
                >
                  {r === "homeowner" ? "Homeowner" : "Trader"}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="wl-postcode" className="text-sm font-medium">
              Your postcode
            </label>
            <input
              id="wl-postcode"
              required
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. NR1 3PN"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="wl-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="wl-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />
          </div>

          {role === "trader" && (
            <div>
              <label htmlFor="wl-trade" className="text-sm font-medium">
                Your trade (optional)
              </label>
              <input
                id="wl-trade"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="e.g. plumber, electrician, roofer"
                className={field}
              />
            </div>
          )}

          <HumanCheck
            question={check.question}
            state={check.state}
            setState={check.setState}
            refresh={check.refresh}
            inputClassName={field.replace("mt-2 w-full", "w-full")}
          />

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember transition-all hover:brightness-110 disabled:opacity-60"
          >
            {mutation.isPending ? "Adding you…" : "Join the waiting list"}
          </button>

          <p className="text-xs text-muted-foreground">
            One email when your area goes live. No marketing spam, unsubscribe
            any time. See our{" "}
            <Link to="/privacy" className="underline hover:text-primary">
              privacy policy
            </Link>
            .
          </p>
        </form>
      </div>
    </Section>
  );
}
