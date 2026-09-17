-- Mark seeded example listings so the directory can label them honestly,
-- and give every listing membership/billing state for paid plans.
ALTER TABLE public.pros
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_slug text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_provider text,
  ADD COLUMN IF NOT EXISTS subscription_ref text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

UPDATE public.pros SET is_demo = true WHERE user_id IS NULL;

-- A claimed listing is never an example listing.
CREATE OR REPLACE FUNCTION public.clear_demo_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    NEW.is_demo := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pros_clear_demo_on_claim ON public.pros;
CREATE TRIGGER pros_clear_demo_on_claim
  BEFORE INSERT OR UPDATE OF user_id ON public.pros
  FOR EACH ROW EXECUTE FUNCTION public.clear_demo_on_claim();
