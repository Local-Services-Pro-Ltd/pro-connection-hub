import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Section } from "@/components/layout-bits";
import {
  confirmWaitingList,
  updateWaitingListPrefs,
} from "@/lib/waiting-list.functions";

const SITE = "https://tradesmanfinder.org";

export const Route = createFileRoute("/waiting-list/confirm")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search["token"] === "string" && search["token"]
      ? { token: search["token"] }
      : {},
  head: () => {
    const description =
      "Confirm your email address to activate your TradesmanFinder waiting-list place.";
    return {
      meta: [
        { title: "Confirm your email | TradesmanFinder" },
        { name: "description", content: description },
        { property: "og:title", content: "Confirm your email" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Confirm your email" },
        { name: "twitter:description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:url", content: `${SITE}/waiting-list/confirm` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/waiting-list/confirm` }],
    };
  },
  component: ConfirmWaitingList,
});

type State =
  | { kind: "working" }
  | { kind: "done"; postcode: string; already: boolean }
  | { kind: "failed" };

function ConfirmWaitingList() {
  const { token } = Route.useSearch();
  const confirm = useServerFn(confirmWaitingList);
  const [state, setState] = useState<State>({ kind: "working" });

  useEffect(() => {
    let live = true;
    if (!token) {
      setState({ kind: "failed" });
      return;
    }
    confirm({ data: { token } })
      .then((result) => {
        if (!live) return;
        setState(
          result.ok
            ? {
                kind: "done",
                postcode: result.postcode,
                already: result.already,
              }
            : { kind: "failed" },
        );
      })
      .catch(() => live && setState({ kind: "failed" }));
    return () => {
      live = false;
    };
  }, [token, confirm]);

  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow">Waiting list</p>
        {state.kind === "working" && (
          <>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
              Confirming your email…
            </h1>
            <p className="mt-5 text-muted-foreground" aria-live="polite">
              One moment while we activate your place.
            </p>
          </>
        )}

        {state.kind === "done" && (
          <>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
              {state.already ? "You're already confirmed." : "You're in."}
            </h1>
            <p className="mt-5 text-muted-foreground" aria-live="polite">
              Your waiting-list place
              {state.postcode ? ` for ${state.postcode}` : ""} is active. We'll
              email you the moment TradesmanFinder opens in your area — nothing
              else in between.
            </p>
          </>
        )}

        {state.kind === "done" && token && <Prefs token={token} />}

        {state.kind === "failed" && (
          <>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
              That link didn't work.
            </h1>
            <p className="mt-5 text-muted-foreground" role="alert">
              The confirmation link looks incomplete or has already been
              replaced by a newer one. Join again and we'll send a fresh link.
            </p>
          </>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/waiting-list"
            search={{}}
            className="rounded-sm border border-border-strong px-6 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Waiting list
          </Link>
          <Link
            to="/areas"
            className="rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            See where we're live
          </Link>
        </div>
      </div>
    </Section>
  );
}

/**
 * Notification preferences, reachable straight from the confirmation link.
 * Full unsubscribe is handled by the email platform's own footer link.
 */
function Prefs({ token }: { token: string }) {
  const save = useServerFn(updateWaitingListPrefs);
  const [launch, setLaunch] = useState(true);
  const [updates, setUpdates] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );

  const commit = (nextLaunch: boolean, nextUpdates: boolean) => {
    setLaunch(nextLaunch);
    setUpdates(nextUpdates);
    setStatus("saving");
    save({
      data: {
        token,
        notifyLaunch: nextLaunch,
        notifyUpdates: nextUpdates,
      },
    })
      .then((r) => setStatus(r.ok ? "saved" : "failed"))
      .catch(() => setStatus("failed"));
  };

  return (
    <div className="mx-auto mt-10 max-w-md rounded-md border border-border bg-card p-6 text-left">
      <p className="eyebrow">Email preferences</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose what we send you. You can also unsubscribe from everything using
        the link at the bottom of any email.
      </p>
      <div className="mt-5 space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={launch}
            onChange={(e) => commit(e.target.checked, updates)}
            className="mt-1 h-4 w-4 rounded-sm border-input accent-[var(--color-primary)]"
          />
          <span>
            Email me the day my area goes live
            <span className="block text-muted-foreground">
              The one email you signed up for.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={updates}
            onChange={(e) => commit(launch, e.target.checked)}
            className="mt-1 h-4 w-4 rounded-sm border-input accent-[var(--color-primary)]"
          />
          <span>
            Occasional progress updates before launch
            <span className="block text-muted-foreground">
              How demand is building in your postcode area.
            </span>
          </span>
        </label>
      </div>
      <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Preferences saved."
            : status === "failed"
              ? "We couldn't save that — please try again."
              : ""}
      </p>
    </div>
  );
}
