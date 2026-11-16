import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/claim/")({
  beforeLoad: () => {
    throw redirect({ to: "/join" });
  },
  head: () => ({
    meta: [
      { title: "Find and claim your listing | TradesmanFinder" },
      {
        name: "description",
        content: "Search for your existing TradesmanFinder listing, or apply to join as a trade.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Find and claim your listing | TradesmanFinder" },
      {
        property: "og:description",
        content: "Search for your existing TradesmanFinder listing, or apply to join as a trade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: function ClaimRedirect() {
    return null;
  },
});
