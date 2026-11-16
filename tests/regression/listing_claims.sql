-- Isolated database regression for reviewed listing claims.
-- Creates one temporary listing, exercises claimant/admin paths, then removes it.
BEGIN;

DELETE FROM public.pros WHERE id = 'zz-claim-review-fixture';
INSERT INTO public.pros (
  id, user_id, name, company, trade_slug, area, area_slug, postcode, bio,
  years, response_mins, day_rate, min_job_budget, availability, services, photo,
  published, rating, review_count, created_at, updated_at, featured,
  contact_email, is_demo, plan_slug, subscription_status, subscription_provider,
  subscription_ref, current_period_end
)
SELECT
  'zz-claim-review-fixture', NULL, name, 'ZZ Claim Review Fixture', trade_slug,
  area, area_slug, postcode, bio, years, response_mins, day_rate, min_job_budget,
  availability, services, photo, true, 0, 0, now(), now(), false, NULL, false,
  plan_slug, subscription_status, subscription_provider, subscription_ref, current_period_end
FROM public.pros WHERE id = 'keystone-london';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SELECT public.submit_listing_claim(
  'zz-claim-review-fixture', 'Test Claimant', 'Owner',
  'claim-fixture@example.com', '07700900123', true
);

RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pros WHERE id = 'zz-claim-review-fixture' AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'pending_claim_linked_account';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.submit_listing_claim(
    'zz-claim-review-fixture', 'Test Claimant', 'Owner',
    'claim-fixture@example.com', '07700900123', true
  );
  RAISE EXCEPTION 'duplicate_open_claim_allowed';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

UPDATE public.pros SET user_id = '11111111-1111-4111-8111-111111111111'
WHERE id = 'zz-claim-review-fixture';
UPDATE public.pro_applications SET status = 'approved'
WHERE claim_pro_id = 'zz-claim-review-fixture';

RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pros WHERE id = 'zz-claim-review-fixture' AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'non_admin_linked_account';
  END IF;
END $$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.pro_applications SET status = 'approved'
WHERE claim_pro_id = 'zz-claim-review-fixture';

RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pros
    WHERE id = 'zz-claim-review-fixture'
      AND user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'approved_claim_did_not_link_account';
  END IF;
END $$;

DELETE FROM public.pros WHERE id = 'zz-claim-review-fixture';
COMMIT;
