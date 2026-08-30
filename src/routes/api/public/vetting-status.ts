import { createFileRoute } from "@tanstack/react-router";
import { VETTING_ACTIONS, VETTING_STAGES } from "@/lib/vetting-status";
import { guardPublicRequest } from "@/lib/api-guard.server";

/**
 * Public, read-only snapshot of the vetting panel: whether any firm is
 * currently featured, plus the stages and actions the homepage renders.
 *
 * Authorization: read-only, GET/HEAD only, and rate limited per visitor.
 * Returns no PII — only public listing fields for published featured firms,
 * which is exactly what the anon SELECT policy on `pros` already allows.
 */
async function handler({ request }: { request: Request }): Promise<Response> {
  const blocked = await guardPublicRequest(request, {
    bucket: "api:vetting-status",
    limit: 60,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

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
}

export const Route = createFileRoute("/api/public/vetting-status")({
  server: {
    handlers: {
      GET: handler,
      HEAD: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
    },
  },
});
