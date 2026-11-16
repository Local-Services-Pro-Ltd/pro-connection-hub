# Moving the live database to the owner's own Supabase project (answers only, no changes)

## 1. A preview database and a separate live database: yes, if these are fixed first

Yes. The browser client and server code read `VITE_SUPABASE_URL`, `SUPABASE_URL` and the publishable and service-role keys from environment variables, so a Cloudflare build can point at another project. Dependencies I found:

| Dependency | Where | Needed on self-managed Supabase |
|---|---|---|
| Hard-coded project ref | `src/lib/security-headers.ts` (`FALLBACK_SUPABASE_URL`), `supabase/config.toml`, `docs/cloudflare-runtime.md`, generated `client.ts` (env fallback) | Remove the fallback in security-headers, or build it from env. If you don't, the CSP `connect-src` may block the new project. Leave the generated file alone and always set the env vars. |
| Google sign-in via the Lovable auth adapter | `src/integrations/lovable/index.ts`, `signin.tsx`, `auth-redirect.ts` | This only works on Lovable Cloud. Production needs native `supabase.auth.signInWithOAuth({provider:'google'})`, your own Google OAuth client, and redirect URLs set in the new project. That's a code branch controlled by an env flag. |
| `LOVABLE_API_KEY` (AI for Ask the Pros, transactional email) | `qa-ai.server.ts`, `email-templates/send-email.ts`, `waiting-list-email.server.ts` | The key is tied to the Lovable workspace and isn't tied to a database. It can be set as a Cloudflare secret if the owner creates a Lovable API key. Otherwise the AI and email paths need another provider. |
| Email sender `notify.tradesmanfinder.org` | Lovable Emails | The domain and DNS are verified through Lovable. It keeps working only through `LOVABLE_API_KEY`. Moving to Resend or Postmark means verifying the domain again. Auth emails (signup and reset) come from the new Supabase project's SMTP and templates, so they must be configured there. |
| Storage buckets | `trade-heroes`, `pro-projects`, `application-docs`, `project-photos` (all private) | Create the buckets yourself. Their `storage.objects` policies are in migrations 0018, 0022, 0032 and 0037. Copy the files across if any exist. |
| pg_cron jobs | `security-regression-daily`, `application-maintenance-daily` (0004, 0034) | Enable `pg_cron` and `pg_net`. Both jobs post to the hard-coded preview URL `project--41f7…lovable.app`, so production must reschedule them against `https://tradesmanfinder.org/...`. |
| `security_scan_secret` table and `SECURITY_SCAN_TOKEN` | Cron header and API routes | Generate a new token, insert it into the table and set the matching Cloudflare secret. |
| Other secrets | `STRIPE_SECRET_KEY`, `COMPANIES_HOUSE_API_KEY`, `PUBLIC_SITE_URL`, `SECURITY_SLACK_WEBHOOK_URL` | Set them in Cloudflare. If the Stripe webhook is in use, its endpoint secret stays the same. |
| Auth settings | Site URL, redirect allow-list, email confirmation, the admin-by-owner-email trigger | Configure these in the new project. There are no auth users today, so no user migration is needed. |

Ongoing caveat: Lovable applies migrations only to Cloud. Each release you must run the new `drizzle/migrations` files against the owner's project yourself, for example with `drizzle-kit migrate` and his connection string, or with the Supabase CLI.

## 2. Are 0000–0043 the complete schema? No

- Before Drizzle there are 16 earlier migrations in `supabase/migrations/` (Aug 5–19 2026). They create the core tables, enums, `profiles`, `user_roles`, `has_role` and similar. Apply them first, then 0000–0043 in order.
- After those, the definitions should be complete: functions, RLS, grants, triggers, storage policies and cron. I haven't diffed this against the live schema. Verification step: run `pg_dump --schema-only` on both databases and compare.
- These are not in migrations and must be created by hand: the bucket rows (bucket rows aren't allowed in migrations here), the extensions if they're missing (`pg_cron`, `pg_net`), the auth-provider configuration, and the `security_scan_secret` value.
- Lovable Cloud doesn't give out the database password or service-role key, so a full `pg_dump` from Cloud isn't possible. The migration files are the source, and data is exported table by table (see 3).

## 3. Data to copy (current live row counts)

- **Reference data (must copy):** `trades` 38, `areas` 16, `plans` 3, `plan_visibility` 3. `trade_hero_images` is currently empty.
- **Content:** `pros` 38 (4 published real firms plus 34 hidden example firms; decide whether to bring the hidden ones), `questions` 5, `answers` 4, `question_ai_reviews` 1 (migration 0039 already seeds the example questions).
- **Real user data:** `waiting_list` 2, `feedback` 2.
- **Skip (logs and runtime state, regenerated):** `security_scan_runs`, `api_access_events`, `pro_feature_audit`, `form_rate_limit`, `background_jobs`. For `security_scan_secret`, create a new one.
- Empty today: jobs, projects, bookings, reviews, leads, applications and documents, so there are no stored files to copy.

## Suggested order (when approved later)
1. Create the owner's project and enable the extensions.
2. Apply `supabase/migrations`, then `drizzle/migrations`.
3. Create the buckets, then reschedule the cron jobs against the production URL with a new token.
4. Export and import the tables in section 3 as CSV.
5. Code: an env-based CSP fallback and native Google sign-in on production.
6. Set the Cloudflare env vars and secrets, deploy, and run `tests/regression` against production.
