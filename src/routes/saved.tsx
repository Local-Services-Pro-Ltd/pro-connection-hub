import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartOff } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { ProCard } from "@/components/pro-card";
import { useSavedPros } from "@/hooks/use-saved-pros";
import { supabase } from "@/integrations/supabase/client";
import type { Pro } from "@/lib/queries";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Your shortlist | TradesmanFinder" },
      {
        name: "description",
        content:
          "The tradespeople you have saved while browsing. Compare them side by side, then book a visit or post your job.",
      },
      { property: "og:title", content: "Your shortlist | TradesmanFinder" },
      {
        property: "og:description",
        content:
          "Compare the vetted tradespeople you saved, then book a visit or post your job.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { ids } = useSavedPros();
  const { data: pros } = useQuery({
    queryKey: ["saved-pros", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pros")
        .select("*")
        .in("id", ids)
        .eq("published", true);
      if (error) throw error;
      return (data ?? []) as Pro[];
    },
  });

  return (
    <Section>
      <SectionHead
        eyebrow="Shortlist"
        title="Your saved tradespeople"
        sub="Saved on this device while you browse — no account needed. Clear your browser data and the list goes with it."
      />

      {ids.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-border p-10 text-center">
          <HeartOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            Nothing saved yet. Tap the heart on any listing to keep it here.
          </p>
          <Link
            to="/trades"
            className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
          >
            Browse trades
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(pros ?? []).map((pro) => (
            <ProCard key={pro.id} pro={pro} />
          ))}
        </div>
      )}
    </Section>
  );
}
