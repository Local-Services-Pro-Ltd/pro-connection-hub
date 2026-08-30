import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import { submitWaitingList } from "@/lib/waiting-list.functions";
import { isLiveArea } from "@/lib/postcode-gate";
import { tradesQuery } from "@/lib/queries";

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

/**
 * Compact waiting-list capture used wherever coverage blocks someone — the
 * areas page, a trade page, the launch tracker. Full-page sign-up lives at
 * /waiting-list; this exists so a "not yet" is never a dead end.
 */
export function WaitingListInline({
  source,
  defaultTrade,
  defaultRole = "homeowner",
  compact = false,
}: {
  source: string;
  defaultTrade?: string;
  defaultRole?: "homeowner" | "trader";
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [role, setRole] = useState<"homeowner" | "trader">(defaultRole);
  const [trade, setTrade] = useState(defaultTrade ?? "");
  const [notifyUpdates, setNotifyUpdates] = useState(false);
  const { data: trades = [] } = useQuery(tradesQuery);
  const [done, setDone] = useState<{
    pending: boolean;
    area: string;
    waiting: number;
  } | null>(null);

  const submit = useServerFn(submitWaitingList);
  const check = useHumanCheck();

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          email: email.trim(),
          postcode: postcode.trim(),
          role,
          ...(trade ? { trade } : {}),
          notifyUpdates,
          source,
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          website: check.state.website,
        },
      }),
    onSuccess: (result) =>
      setDone({
        pending: Boolean(result?.pending),
        area: result?.area ?? "",
        waiting: Number(result?.waiting ?? 0),
      }),
    onError: (e: Error) => {
      toast.error(e.message);
      check.refresh();
    },
  });

  if (done) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary/15">
          <Check className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-4 font-display text-lg font-semibold">
          {done.pending ? "Check your inbox to finish." : "You're on the list."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {done.pending
            ? "We've emailed you a confirmation link — click it and your place is active."
            : done.waiting > 1
              ? `${done.waiting} people are now waiting in ${done.area}. The more sign-ups an area gets, the sooner we open it.`
              : `You're first in line for ${done.area}. We'll email you the day we open.`}
        </p>
        <Link
          to="/coverage"
          className="mt-4 inline-flex font-display text-sm font-semibold text-primary underline underline-offset-4"
        >
          Track your area's progress
        </Link>
      </div>
    );
  }

  const covered = postcode.trim().length > 1 && isLiveArea(postcode);

  return (
    <form
      className="space-y-5 rounded-md border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className={compact ? "space-y-5" : "grid gap-5 sm:grid-cols-2"}>
        <label className="block">
          <span className="eyebrow">Postcode</span>
          <input
            required
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="e.g. M1 4BT"
            className={field}
          />
        </label>
        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow">
          {role === "trader" ? "Your trade" : "Job you need doing"}
        </span>
        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className={field}
        >
          <option value="">
            {role === "trader" ? "Select your trade" : "Any trade"}
          </option>
          {trades.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="eyebrow">I'm a</legend>
        <div className="mt-2 flex gap-3">
          {(["homeowner", "trader"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-sm border px-4 py-2 font-display text-sm font-semibold ${
                role === r
                  ? "border-primary text-primary"
                  : "border-border-strong text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {r === "homeowner" ? "Homeowner" : "Trade"}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={notifyUpdates}
          onChange={(e) => setNotifyUpdates(e.target.checked)}
          className="mt-1 h-4 w-4 rounded-sm border-input accent-[var(--color-primary)]"
        />
        <span>
          Also send me occasional progress updates on my area before it opens.
        </span>
      </label>

      <HumanCheck
        question={check.question}
        state={check.state}
        setState={check.setState}
        refresh={check.refresh}
        inputClassName={field}
      />

      {covered && (
        <p className="text-sm text-muted-foreground">
          Good news — we're already live in that postcode. You can{" "}
          <Link
            to="/post-job"
            search={{}}
            className="font-medium text-primary underline underline-offset-2"
          >
            post a job now
          </Link>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
      >
        {mutation.isPending ? "Adding you…" : "Join the waiting list"}
      </button>
      <p className="text-xs text-muted-foreground">
        One email when we open your area. Nothing else, and you can ask us to
        delete your details at any time.
      </p>
    </form>
  );
}
