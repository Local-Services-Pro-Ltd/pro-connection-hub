import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://tradesmanfinder.org";

interface SitemapEntry {
  path: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

/** Public, indexable static routes. /account, /signin, /admin/* stay out. */
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/trades", changefreq: "weekly", priority: "0.9" },
  { path: "/costs", changefreq: "weekly", priority: "0.9" },
  ...allCostGuides().map((g) => ({
    path: `/costs/${g.slug}`,
    changefreq: "monthly" as const,
    priority: "0.7",
  })),
  { path: "/areas", changefreq: "weekly", priority: "0.8" },
  { path: "/for-tradesmen", changefreq: "monthly", priority: "0.8" },
  { path: "/post-job", changefreq: "monthly", priority: "0.8" },
  { path: "/verification", changefreq: "monthly", priority: "0.6" },
  { path: "/waiting-list", changefreq: "monthly", priority: "0.6" },
  { path: "/enterprise", changefreq: "monthly", priority: "0.5" },
  { path: "/claim", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        try {
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
          const supabasePublic = createClient<Database>(
            process.env["SUPABASE_URL"]!,
            key,
            {
              auth: { persistSession: false, autoRefreshToken: false },
              global: {
                fetch: (input, init) => {
                  const headers = new Headers(init?.headers);
                  if (
                    key.startsWith("sb_") &&
                    headers.get("Authorization") === `Bearer ${key}`
                  ) {
                    headers.delete("Authorization");
                  }
                  headers.set("apikey", key);
                  return fetch(input, { ...init, headers });
                },
              },
            },
          );

          const [trades, pros] = await Promise.all([
            supabasePublic.from("trades").select("slug").order("sort_order"),
            supabasePublic.from("pros").select("id").eq("published", true),
          ]);

          for (const trade of trades.data ?? []) {
            entries.push({
              path: `/trades/${trade.slug}`,
              changefreq: "weekly",
              priority: "0.7",
            });
          }
          for (const pro of pros.data ?? []) {
            entries.push({
              path: `/pro/${pro.id}`,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch (error) {
          // A database hiccup shouldn't take the whole sitemap down.
          console.error("[sitemap] dynamic entries unavailable", error);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
