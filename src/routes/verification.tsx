import { createFileRoute, redirect } from "@tanstack/react-router";

// TODO(handover): temporary placeholder. A standalone verification explainer
// page will follow — until then /verification jumps to the explainer section
// on the pricing page.
export const Route = createFileRoute("/verification")({
  beforeLoad: () => {
    throw redirect({
      to: "/for-tradesmen",
      hash: "verification",
      replace: true,
    });
  },
});
