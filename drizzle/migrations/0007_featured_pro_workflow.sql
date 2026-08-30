-- Audit log of every featuring / unfeaturing action.
CREATE TABLE IF NOT EXISTS public.pro_feature_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL,
  pro_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  was_featured boolean,
  is_featured boolean NOT NULL,
  published boolean NOT NULL DEFAULT false,
  verified_credentials integer NOT NULL DEFAULT 0,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pro_feature_audit TO authenticated;
GRANT ALL ON public.pro_feature_audit TO service_role;
ALTER TABLE public.pro_feature_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro feature audit admin read" ON public.pro_feature_audit;
CREATE POLICY "pro feature audit admin read" ON public.pro_feature_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins manage listings and credential verification.
DROP POLICY IF EXISTS "pros admin all" ON public.pros;
CREATE POLICY "pros admin all" ON public.pros
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "credentials admin all" ON public.pro_credentials;
CREATE POLICY "credentials admin all" ON public.pro_credentials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- A firm can only be featured once it is published AND has at least one
-- admin-verified credential. Enforced in the database, not just in the UI.
CREATE OR REPLACE FUNCTION public.enforce_pro_feature_requirements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_verified integer;
BEGIN
  IF NEW.featured THEN
    IF NOT NEW.published THEN
      RAISE EXCEPTION 'cannot feature an unpublished listing';
    END IF;
    SELECT count(*) INTO v_verified
      FROM public.pro_credentials c
     WHERE c.pro_id = NEW.id AND c.verified;
    IF v_verified = 0 THEN
      RAISE EXCEPTION 'cannot feature a listing with no verified credential';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pros_zz_enforce_feature_requirements ON public.pros;
CREATE TRIGGER pros_zz_enforce_feature_requirements
  BEFORE INSERT OR UPDATE ON public.pros
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pro_feature_requirements();

CREATE OR REPLACE FUNCTION public.log_pro_feature_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  actor_email text;
  v_verified integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.featured IS NOT DISTINCT FROM OLD.featured THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NOT NEW.featured THEN
    RETURN NEW;
  END IF;

  SELECT email INTO actor_email FROM auth.users WHERE id = actor;
  SELECT count(*) INTO v_verified FROM public.pro_credentials c
   WHERE c.pro_id = NEW.id AND c.verified;

  INSERT INTO public.pro_feature_audit
    (pro_id, pro_name, action, was_featured, is_featured, published,
     verified_credentials, changed_by, changed_by_email)
  VALUES
    (NEW.id, NEW.company, CASE WHEN NEW.featured THEN 'featured' ELSE 'unfeatured' END,
     CASE WHEN TG_OP = 'UPDATE' THEN OLD.featured ELSE NULL END,
     NEW.featured, NEW.published, v_verified, actor, actor_email);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pros_feature_audit ON public.pros;
CREATE TRIGGER pros_feature_audit
  AFTER INSERT OR UPDATE ON public.pros
  FOR EACH ROW EXECUTE FUNCTION public.log_pro_feature_change();

-- Regression checks for the homepage featured section, admin-only.
CREATE OR REPLACE FUNCTION public.featured_pro_regression()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trade text;
  v_pro text;
  v_count integer;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_results := v_results || jsonb_build_object(
    'check_name', 'featured_requires_admin_trigger',
    'passed', EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                      WHERE t.tgrelid = 'public.pros'::regclass AND NOT t.tgisinternal
                        AND p.proname = 'enforce_pro_publish_approval'),
    'detail', 'non-admins cannot set pros.featured');

  v_results := v_results || jsonb_build_object(
    'check_name', 'feature_actions_are_audited',
    'passed', EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                      WHERE t.tgrelid = 'public.pros'::regclass AND NOT t.tgisinternal
                        AND p.proname = 'log_pro_feature_change'),
    'detail', 'pro_feature_audit trigger present');

  SELECT count(*) INTO v_count FROM public.pros
   WHERE featured AND (NOT published OR NOT EXISTS (
     SELECT 1 FROM public.pro_credentials c WHERE c.pro_id = pros.id AND c.verified));
  v_results := v_results || jsonb_build_object(
    'check_name', 'no_unvetted_featured_listing',
    'passed', v_count = 0,
    'detail', 'unvetted featured rows=' || v_count);

  SELECT slug INTO v_trade FROM public.trades ORDER BY sort_order LIMIT 1;
  BEGIN
    v_pro := 'featprobe-' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.pros (id, user_id, name, company, trade_slug, area, published)
    VALUES (v_pro, NULL, 'Feature Probe', 'Feature Probe Ltd', v_trade, 'Probe Area', true);
    UPDATE public.pros SET published = true WHERE id = v_pro;

    BEGIN
      UPDATE public.pros SET featured = true WHERE id = v_pro;
      v_results := v_results || jsonb_build_object(
        'check_name', 'unverified_firm_cannot_be_featured',
        'passed', NOT (SELECT featured FROM public.pros WHERE id = v_pro),
        'detail', 'update was not rejected');
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object(
        'check_name', 'unverified_firm_cannot_be_featured',
        'passed', true, 'detail', 'rejected: ' || SQLERRM);
    END;

    RAISE EXCEPTION 'featured_pro_regression_rollback';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'featured_pro_regression_rollback' THEN
      v_results := v_results || jsonb_build_object(
        'check_name', 'featured_probe_error', 'passed', false, 'detail', SQLERRM);
    END IF;
  END;

  RETURN QUERY
  SELECT e->>'check_name', (e->>'passed')::boolean, e->>'detail'
  FROM jsonb_array_elements(v_results) e;
END;
$function$;

REVOKE ALL ON FUNCTION public.featured_pro_regression() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.featured_pro_regression() TO service_role;

CREATE OR REPLACE FUNCTION public.security_regression_run()
RETURNS TABLE(suite text, check_name text, passed boolean, detail text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'posture', * FROM public.security_posture_check()
  UNION ALL
  SELECT 'rbac', * FROM public.security_rbac_probe()
  UNION ALL
  SELECT 'featured', * FROM public.featured_pro_regression();
$function$;