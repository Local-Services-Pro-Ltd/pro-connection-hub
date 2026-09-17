// Minimal ambient declaration for the Cloudflare Workers built-in module.
// Avoids pulling in the full @cloudflare/workers-types package (and its
// lockfile churn) just for this one runtime-bindings accessor.
declare module "cloudflare:workers" {
  export const env: Record<string, string | undefined>;
}
