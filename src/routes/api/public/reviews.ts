import { createFileRoute } from "@tanstack/react-router";
import { badRequest, guardPublicRequest } from "@/lib/api-guard.server";

/**
 * Public, read-only review feed.
 *
 * Authorization model:
 *  - GET/HEAD only, rate limited per visitor.
 *  - Reads go through `reviews_public`, the security-barrier view that pins
 *    `status = 'published'` and omits the reviewer's account id and location,
 *    so no unpublished review or reviewer PII can ever leave this endpoint.
 *  - Uses the publishable (anon) key, never the service role, so the database
 *    enforces the same rules it enforces for the browser.
 */
const MAX_LIMIT = 50;

async function handler({ request }: { request: Request }): Promise<Response> {
  const blocked = await guardPublicRequest(request, {
    bucket: "api:reviews",
    limit: 60,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  const params = new URL(request.url).searchParams;
  const proId = params.get("pro_id");
  const limit = Math.min(
    Math.max(Number(params.get("limit") ?? 20) || 20, 1),
    MAX_LIMIT,
  );

  if (proId && !/^[A-Za-z0-9-]{1,64}$/.test(proId)) {
    return badRequest("pro_id must be an alphanumeric listing id");
  }

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  const query = new URLSearchParams({
    select: "id,pro_id,author_name,rating,title,body,job_type,created_at",
    order: "created_at.desc",
    limit: String(limit),
  });
  if (proId) query.set("pro_id", `eq.${proId}`);

  try {
    const res = await fetch(`${url}/rest/v1/reviews_public?${query}`, {
      headers: { apikey: key },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const reviews = await res.json();
    return new Response(JSON.stringify({ count: reviews.length, reviews }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60",
      },
    });
  } catch (err) {
    console.error("[reviews] public read failed", err);
    return new Response(JSON.stringify({ error: "reviews_unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/public/reviews")({
  server: { handlers: { GET: handler, HEAD: handler } },
});
