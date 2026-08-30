import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Section } from "@/components/layout-bits";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import {
  getWaitingListEntry,
  updateWaitingListEntry,
} from "@/lib/waiting-list.functions";
import { tradesQuery } from "@/lib/queries";

const SITE = "https://tradesmanfinder.org";

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

export const Route = createFileRoute("/waiting-list/manage")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search["token"] === "string" && search["token"]
      ? { token: search["token"] }
      : {},
  head: () => {
    const description =
      "Update the postcode area and trade type on your TradesmanFinder waiting-list place.";
    return {
      meta: [
        { title: "Update your waiting-list details | TradesmanFinder" },
        { name: "description", content: description },
        { property: "og:title", content: "Update your waiting-list details" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Update your waiting-list details" },
        { name: "twitter:description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:url", content: `${SITE}/waiting-list/manage` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/waiting-list/manage` }],
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
  component: ManageWaitingList,
});

function ManageWaitingList() {
  const { token } = Route.useSearch();
  const load = useServerFn(getWaitingListEntry);
  const save = useServerFn(updateWaitingListEntry);
  const check = useHumanCheck();
  const { data: trades = [] } = useQuery(tradesQuery);

  const entry = useQuery({
    queryKey: ["waiting-list", "entry", token ?? ""],
    enabled: Boolean(token),
    retry: false,
    queryFn: () => load({ data: { token: token as string } }),
  });

  const [postcode, setPostcode] = useState("");
  const [trade, setTrade] = useState("");
  const [saved, setSaved] = useState<{ postcode: string } | null>(null);

  useEffect(() => {
    if (entry.data) {
      setPostcode(entry.data.postcode.toUpperCase());
      setTrade(entry.data.trade ?? "");
    }
  }, [entry.data]);

  const mutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          token: token as string,
          postcode,
          trade,
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          website: check.state.website,
        },
      }),
    onSuccess: (result) => {
      setSaved({ postcode: result.postcode });
      check.refresh();
      toast.success("Your details are updated.");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      check.refresh();
    },
  });

  if (!token) {
    return (
      <Section>
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow">Waiting list</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
            We need your personal link.
          </h1>
          <p className="mt-5 text-muted-foreground">
            Open the "update your details" link from your confirmation email —
            it carries the private token that proves the place is yours.
          </p>
          <Link
            to="/waiting-list"
            search={{}}
            className="mt-8 inline-flex rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Join the waiting list
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">Waiting list</p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Update your details.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Moved, or need a different trade? Change your postcode area and trade
          type here — your place and confirmation stay intact.
        </p>

        {entry.isPending && (
          <p className="mt-8 text-muted-foreground">Loading your details…</p>
        )}

        {entry.isError && (
          <p className="mt-8 text-muted-foreground" role="alert">
            {(entry.error as Error).message} Join again and we'll send you a
            fresh link.
          </p>
        )}

        {entry.data && (
          <form
            className="mt-10 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div>
              <label htmlFor="mg-postcode" className="text-sm font-medium">
                Your postcode
              </label>
              <input
                id="mg-postcode"
                required
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                placeholder="e.g. ME14 1AA"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="mg-trade" className="text-sm font-medium">
                {entry.data.role === "trader"
                  ? "Your trade"
                  : "Trade you're likely to need"}
              </label>
              <select
                id="mg-trade"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className={field}
              >
                <option value="">
                  {entry.data.role === "trader"
                    ? "Select your trade"
                    : "Any trade"}
                </option>
                {trades.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

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
              {mutation.isPending ? "Saving…" : "Save changes"}
            </button>

            {saved && (
              <p className="text-sm text-primary" aria-live="polite">
                Saved — you're now on the list for {saved.postcode}.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Changing your postcode moves your place to that area's queue. Your
              email preferences are unchanged — manage those from the link in
              your confirmation email.
            </p>
          </form>
        )}
      </div>
    </Section>
  );
}
