# TradesmanFinder launch roadmap

## Data consistency

- [x] Single source of truth for pro counts (map hero now reads the directory)
- [x] Every listed pro relocated into a live area (London, Kent, Surrey)

## Broken / empty sections

- [x] Project board renders server-side (no permanent "Loading the board…")
- [x] Warmer empty states; 4 labelled example questions seeded (reviews left unseeded — real jobs only)
- [x] Nav audit — all main links return a real page

## Free onboarding

- [x] One shared onboarding flag disables checkout and preserves dormant billing code
- [x] Approved firms receive Trade-tier access in app and database enforcement
- [x] Pricing, dashboard founding status, and trader terms explain free onboarding
- [x] Regression tests cover checkout isolation, Trade limits, and pricing wording
- [ ] Owner/solicitor review of the new Free onboarding period trader terms

## CI reliability

- [x] Skip secret-dependent GitHub security checks cleanly while preserving offline CI failures

## Functional completeness

- [ ] Confirm Post a job submits + confirmation screen and email
- [ ] Confirm sign-in / sign-up works for homeowners and tradespeople
- [x] Tradesperson dashboard (/dashboard): leads, visits, profile editing, portfolio photos, membership
- [x] Firm directory page (/directory) grouped by trade, demo entries labelled "Example listing"
- [x] Subscription billing for Starter £29 / Trade £79 (Stripe, own account; checkout + portal + dashboard unlock)
- [ ] Photo upload on the job posting form

## Trust & legal

- [x] Follow-up: remove remaining network-wide trust and coverage claims, and extend public-page wording checks (not published)
- [x] Footer: Local Services Pro Ltd, company no. 12126782, 38 Bloomfield Road, London SE18 7JH, ICO 00015543780
- [x] Owner-approved trust cleanup: hide 34 invented firms, remove Steve Test Builders, and mark four real firms as vetting in progress
- [x] Replace unverified counts, vetting, response-time and review claims across public pages and metadata
- [x] Add regression checks for hidden firms and zero-review ratings
- [x] Review vetting/verification claims for ASA/CMA accuracy
- [ ] Privacy Policy + Terms GDPR review

## SEO

- [ ] Unique title/description on every page
- [ ] robots.txt, sitemap.xml, no stray noindex
- [ ] LocalBusiness/Service schema on trade and area pages
- [ ] Canonicals across all trade pages

## Polish

- [ ] Mobile pass (job form, trade filters)
- [ ] Analytics with conversion tracking on Post a job / For tradesmen
- [ ] Reduce "coming soon" clutter

## /join application redesign

- [x] /join page (hero, fact tiles, steps, accordion, form, success)
- [x] business_type column + optional insurance/CH/accreditations at submission
- [x] CTAs to /join; For tradesmen 2-working-day reply
- [x] Application-received email wording; admin shows business type
- [x] Tests

## Navigation and reviewed listing claims

- [x] Declutter desktop/mobile header and move appearance controls to footer
- [x] Centre /join, add listing search, and improve field-level form feedback
- [x] Add /claim/$proId account and admin-reviewed claim flow
- [x] Verify claim security, duplicate prevention, header widths, and screenshots

## Cloudflare release reliability

- [x] Recover once from stale hashed chunks without reload loops
- [x] Serve all app media locally on Cloudflare Pages
- [x] Restore lint, safe dependency audit, and build checks

## Account recovery and onboarding wording

- [x] Replace "A real person" with compliance and onboarding team wording everywhere
- [x] Add sign-in and claim-form links to password recovery
- [x] Add noindex forgot-password and reset-password routes with human checks and recovery-session handling
- [x] Add regression coverage and run lint, typecheck, tests, and build
- [x] Add accessible password visibility controls and live reset-password match hints

## Homepage photography and theme polish

- [x] Add lightweight local trade photography to the homepage paths and trust block
- [x] Default first-time visitors to Light while preserving saved theme choices
- [x] Audit Light/Dim/Dark contrast, button hierarchy and responsive layouts
- [x] Show town and county on listing cards and profile headers
- [x] Run checks, verify all themes at desktop and phone widths, and commit without publishing

## Page photography and header theme access

- [x] Enlarge homepage path-card photography without increasing desktop card height excessively
- [x] Add an accessible, synchronised theme menu to desktop and mobile headers
- [x] Add reusable PageBanner imagery to the requested inner pages
- [x] Add local fallback trade photography with missing-image handling
- [x] Verify Light/Dim/Dark at desktop and phone widths, run checks, and commit without publishing

## Official-register credential checks

- [x] Add shared register links and verified/expired/pending credential states
- [x] Show dated register checks and renewal states on firm profiles
- [x] Add an admin-only credential editor with verification timestamps
- [x] Maintain expired and inactive Companies House credentials in the nightly job
- [x] Exclude expired credentials from displayed trust counts and scores
- [x] Run regression checks, typecheck and lint; commit without publishing or database changes

## AI job helper and contact-choice wording

- [x] Add a rate-limited, validated AI job helper server function with Gemini settings and safe failure
- [x] Add the optional helper, preview, form pre-fill and existing cost-guide range to /post-job
- [x] Replace only the requested homeowner contact-choice wording and metadata
- [x] Add regression tests and run existing tests, typecheck, lint and browser checks
- [x] Commit without publishing or changing database schema

## Firm job interest and local area pages

- [x] Add authenticated, privacy-safe job listing and interest server functions using the existing job_interest table
- [x] Send the homeowner interest email and add dashboard/account interest interfaces
- [x] Add live-area and area-trade routes, regional cost ranges, metadata, breadcrumbs and sitemap entries
- [x] Apply only the requested job-promise wording and description privacy hint
- [x] Add privacy and area-region tests; run typecheck, lint, existing tests and browser checks
- [x] Commit without publishing or changing migrations, tables, columns or policies
