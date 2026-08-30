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

const SUPABASE_URL = (
  process.env["SUPABASE_URL"] ??
  process.env["VITE_SUPABASE_URL"] ??
  ""
).replace(/\/+$/, "");

const SUPABASE_WS = SUPABASE_URL.replace(/^https:/, "wss:");

const LOVABLE_FRAME_ANCESTORS = [
  "'self'",
  "https://lovable.dev",
  "https://*.lovable.dev",
  "https://*.lovable.app",
  "https://*.lovableproject.com",
];

function policy(): string {
  const connect = [
    "'self'",
    SUPABASE_URL,
    SUPABASE_WS,
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

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    headers.set("Content-Security-Policy", policy());
  }

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // No X-Frame-Options: frame-ancestors above is the modern, more precise control.
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
