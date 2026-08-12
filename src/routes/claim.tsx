import { createFileRoute, redirect } from "@tanstack/react-router";

// TODO(handover): temporary placeholder. The full claim-a-listing flow is a
// separate piece of work — until it ships, /claim (and /claim?plan=trade)
// hands off to sign-in with the claim intent and plan preserved.
export const Route = createFileRoute("/claim")({
  validateSearch: (search: Record<string, unknown>): { plan?: string } =>
    typeof search["plan"] === "string" && search["plan"]
      ? { plan: search["plan"] }
      : {},
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/signin",
      search: {
        intent: "claim" as const,
        ...(search.plan ? { plan: search.plan } : {}),
      },
      replace: true,
    });
  },
});
