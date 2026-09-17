/**
 * Security headers applied to every response by src/server.ts.
 *
 * The Content-Security-Policy is deliberately tight everywhere it can be:
 * only same-origin scripts, no plugins, no framing except by Lovable's
 * editor preview, and an explicit allow-list for the backend and Google
 * Fonts. `'unsafe-inline'` stays on script-src because the SSR runtime and
 * the theme bootstrap emit inline <script> tags; every other directive is
 * strict, so injected third-party script URLs, form posts, frames, objects
 * and connections are all blocked.
 */

// Cloudflare Workers only guarantee bindings via the per-request `env`
// object passed to `fetch(request, env, ctx)`. `process.env` is a Node.js
// compatibility polyfill that populates lazily inside a request's async
// context — it is not reliable at module top-level (evaluated once, at
// isolate cold start, before any request context exists), which is why a
// module-level constant here always resolved to "". Resolving the URL
// inside `policy()` from the real per-request `env` fixes that.
type RuntimeEnv = Record<string, string | undefined> | undefined;

function resolveSupabaseUrl(env: RuntimeEnv): string {
  const raw =
    env?.["SUPABASE_URL"] ??
    env?.["VITE_SUPABASE_URL"] ??
    process.env["SUPABASE_URL"] ??
    process.env["VITE_SUPABASE_URL"] ??
    "";
  return raw.replace(/\/+$/, "");
}

const LOVABLE_FRAME_ANCESTORS = [
  "'self'",
  "https://lovable.dev",
  "https://*.lovable.dev",
  "https://*.lovable.app",
  "https://*.lovableproject.com",
];

function policy(env: RuntimeEnv): string {
  const supabaseUrl = resolveSupabaseUrl(env);
  const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");
  const connect = [
    "'self'",
    supabaseUrl,
    supabaseWs,
    "https://*.lovable.dev",
    "https://*.lovable.app",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    // Inline scripts are required by SSR hydration + the theme bootstrap.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `frame-ancestors ${LOVABLE_FRAME_ANCESTORS.join(" ")}`,
    "frame-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function applySecurityHeaders(
  response: Response,
  request?: Request,
  env?: RuntimeEnv,
): Response {
  const headers = new Headers(response.headers);

  const contentType = headers.get("content-type") ?? "";
  // Dev/preview tooling (Vite HMR, the Lovable editor bridge) evaluates code
  // strings, which a strict policy forbids — enforce CSP in production only.
  const isProd = (env?.["NODE_ENV"] ?? process.env["NODE_ENV"]) === "production";
  if (isProd && contentType.includes("text/html")) {
    headers.set("Content-Security-Policy", policy(env));
  }

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // frame-ancestors above is the precise control; X-Frame-Options is the
  // legacy fallback for older browsers. It has no allow-list, so it is only
  // safe on the live site — the Lovable editor legitimately frames previews.
  const host = request ? new URL(request.url).hostname : "";
  const isLovableHost =
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com") ||
    host === "localhost";
  if (isProd && !isLovableHost) {
    headers.set("X-Frame-Options", "SAMEORIGIN");
  }

  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  // Geolocation stays enabled for the live coverage map; everything else off.
  headers.set(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
