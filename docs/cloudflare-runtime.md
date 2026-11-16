# Cloudflare Pages runtime configuration

Applies to `pro-connection-hub.pages.dev`, `tradesmanfinder.org` and
`www.tradesmanfinder.org`. The backend is **muohvxodwefhwjhdqbxh**.
Do not use keys from the retiring **jqvrelqnfuczxgpiayvg** project.

## Configuration ownership

Pages runtime bindings are managed in the Cloudflare dashboard.
`vite.config.ts` disables Nitro's generated Wrangler deployment configuration
when `CF_PAGES=1`. Otherwise that generated configuration, which contains no
project variables, replaces the dashboard's plain-text variables on deployment.
Lovable's own build configuration is unchanged.

Cloudflare documentation:
https://developers.cloudflare.com/pages/functions/wrangler-configuration/

Keep `nodejs_compat` enabled and the current compatibility date. The app uses
server-side `process.env` bindings; secrets must never have a `VITE_` prefix.

## Bindings

| Variable | Storage | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Plain text | New project's API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Plain text | User-authenticated server requests |
| `VITE_SUPABASE_URL` | Plain text | Browser API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Plain text | Browser public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Encrypted secret | Privileged server operations; never use the public key here |
| `STRIPE_SECRET_KEY` | Encrypted secret | Correct TradesmanFinder Stripe account |
| `LOVABLE_API_KEY` | Encrypted secret | Lovable email/AI services; must support this deployment |
| `PAYMENTS_ENABLED` | Plain text, default absent/false | Checkout stays disabled until explicitly set to `true` after approval |

Secret names alone do not prove the credentials work. Verify the backend project
and Stripe account, service permissions, and an authorised end-to-end flow.
Do not commit secrets, print them in logs, or copy production secrets into preview
without a deliberate environment-isolation decision.

## Google authentication

Self-hosted domains use Supabase OAuth directly. Lovable-hosted domains retain
Lovable's native adapter. The return URL is the same origin's `/signin` with a
validated relative destination in the `redirect` parameter.

In the **new** Supabase project's Auth URL configuration, allow the required
sign-in callback paths and query strings for these controlled origins:

- `https://pro-connection-hub.pages.dev/signin**`
- `https://tradesmanfinder.org/signin**`
- `https://www.tradesmanfinder.org/signin**`

These are configuration requirements, not a claim that the allow-list has been
verified. Keep preview-host allowances restricted to this project.
Preserve any existing signup confirmation URLs in the allow-list.

Provider setup: https://supabase.com/docs/guides/auth/social-login/auth-google

## Release checks

- `bun run test:deployment`
- TypeScript check and Cloudflare-target build.
- After deployment, compare configured binding names with the active deployment.
- Google button must reach the provider rather than `/~oauth/initiate` on Pages.
- Complete login and return to the intended page with an approved test account.
- Confirm live-region postcode acceptance and coming-soon rejection.
- Do not post a public test job, email real users or charge a card without approval.

The GitHub live-database security scan is optional. When `SUPABASE_URL` or
`SUPABASE_SERVICE_ROLE_KEY` is absent from the repository secrets, GitHub Actions
skips the live scan and access-control tests with a warning instead of failing;
typecheck, lint, dependency audit, offline regression tests, and build still run
and fail normally on problems. The existing daily database scan cron inside the
backend remains the source of truth for live-database checks.

Restoring Pages bindings does not populate GitHub Actions secrets or prove that
the optional GitHub live scan has passed.

## Self-hosted production database (tradesmanfinder.org)

Preview keeps using Lovable Cloud. The live site on Cloudflare Pages uses the
owner's own database project **fzijsbkoiuhvjfmuvbrl** (London). The same build
works on both; the provider is chosen at runtime from env vars.

Cloudflare Pages env vars:

| Name | Type | Notes |
| --- | --- | --- |
| SUPABASE_URL | plain | `https://fzijsbkoiuhvjfmuvbrl.supabase.co`; also feeds the CSP |
| SUPABASE_PUBLISHABLE_KEY | plain | |
| VITE_SUPABASE_URL | plain (build) | same as SUPABASE_URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | plain (build) | |
| SUPABASE_SERVICE_ROLE_KEY | secret | server functions, cron routes |
| RESEND_API_KEY | secret | when set, email goes via Resend instead of Lovable Emails; From `TradesmanFinder <noreply@notify.tradesmanfinder.org>` (verify the domain in Resend) |
| GEMINI_API_KEY | secret | when set, AI goes to Google Gemini instead of the Lovable AI gateway; without any key questions are saved with no AI answer |
| SECURITY_SCAN_TOKEN | secret | cron route token |
| STRIPE_SECRET_KEY | secret | payments stay off while ONBOARDING_FREE is on |
| PUBLIC_SITE_URL | plain | `https://tradesmanfinder.org` |
| GOOGLE_AUTH_ENABLED | optional | `true` shows "Continue with Google" off Lovable hosting (Google provider must be configured in the database project) |

GitHub secret **PRODUCTION_DB_URL**: Postgres connection string used by
`.github/workflows/migrate-production.yml` to apply each migration to production before release.

Scheduled jobs (reschedule on production pointing at `https://tradesmanfinder.org`):

- `GET|POST /api/public/security-scan`
- `GET|POST /api/public/application-maintenance`

Both require header `x-security-scan-token: <token>` or `Authorization: Bearer <token>`,
where the token equals `SECURITY_SCAN_TOKEN` or matches the database's
`security_scan_token_matches()` secret. Both are rate limited.
