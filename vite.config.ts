// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Server-side code (email routes, server functions) reads unprefixed env vars
// such as LOVABLE_API_KEY from process.env. These are never added to the
// client define block, so nothing here reaches the browser bundle.
Object.assign(process.env, loadEnv(process.env["MODE"] ?? "development", process.cwd(), ""));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // Email rendering needs entities v4; a nested v7 copy drops ./lib/decode.js
        // and breaks SSR, so pin every import to the hoisted v4 install.
        "entities/lib/decode.js": path.resolve(
          dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(dirname, "node_modules/entities"),
      },
    },
  },
});
