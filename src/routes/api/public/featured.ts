import { createFileRoute } from "@tanstack/react-router";
import { guardPublicRequest } from "@/lib/api-guard.server";

/**
 * Public, read-only featured firm feed.
 *
 * Authorization model:
 *  - GET/HEAD only, rate limited per visitor.
 *  - Uses the publishable (anon) key, so the `pros public read` policy
 *    (published = true) applies exactly as it does in the browser, and the
 *    projection is limited to columns already shown on the public directory.
 *  - `featured = true` is admin-controlled at the database level (trigger +
 *    audit), so this endpoint can never surface an unvetted firm.
 */
async function handler({ request }: { request: Request }): Promise<Response> {
  const blocked = await guardPublicRequest(request, {
    bucket: "api:featured",
    limit: 60,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  const query = new URLSearchParams({
    select:
      "id,company,trade_slug,area,area_slug,bio,years,rating,review_count,services,photo,availability",
    published: "eq.true",
    featured: "eq.true",
    order: "rating.desc",
    limit: "12",
  });

  try {
    const res = await fetch(`${url}/rest/v1/pros?${query}`, {
      headers: { apikey: key },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const firms = await res.json();
    return new Response(
      JSON.stringify({ count: firms.length, featured: firms.length > 0, firms }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("[featured] public read failed", err);
    return new Response(JSON.stringify({ error: "featured_unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/public/featured")({
  server: {
    handlers: {
      GET: handler,
      HEAD: handler,
      // Registered only so writes get an explicit 405 from the guard rather
      // than falling through to the SPA renderer.
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
    },
  },
});
