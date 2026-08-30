import { createFileRoute } from "@tanstack/react-router";
import { VETTING_ACTIONS, VETTING_STAGES } from "@/lib/vetting-status";

/**
 * Public, read-only snapshot of the vetting panel: whether any firm is
 * currently featured, plus the stages and actions the homepage renders.
 * Returns no PII — only public listing fields for featured firms.
 */
export const Route = createFileRoute("/api/public/vetting-status")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const url = process.env["SUPABASE_URL"]!;

        let featured: Array<{
          id: string;
          company: string;
          trade_slug: string;
          area: string;
        }> = [];
        let error: string | null = null;

        try {
          const res = await fetch(
            `${url}/rest/v1/pros?select=id,company,trade_slug,area&published=eq.true&featured=eq.true&order=rating.desc&limit=6`,
            { headers: { apikey: key } },
          );
          if (!res.ok) throw new Error(`status ${res.status}`);
          featured = await res.json();
        } catch (e) {
          error = "featured_unavailable";
          console.error("[vetting-status] featured lookup failed", e);
        }

        return new Response(
          JSON.stringify({
            featuredCount: featured.length,
            showVettingPanel: featured.length === 0,
            featured,
            stages: VETTING_STAGES,
            actions: VETTING_ACTIONS,
            ...(error ? { error } : {}),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=30",
            },
          },
        );
      },
    },
  },
});
