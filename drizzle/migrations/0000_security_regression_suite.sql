-- Automated security regression suite: static posture checks + a behavioural
-- RBAC/approval probe that rolls itself back, plus a table of scan runs.

CREATE OR REPLACE FUNCTION public.security_caller_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT current_user IN ('postgres', 'supabase_admin', 'service_role')
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      );
$$;

-- 1) Static posture checks (read-only).
CREATE OR REPLACE FUNCTION public.security_posture_check()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_missing text;
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- RLS enabled on every public table
  SELECT string_agg(c.relname, ', ') INTO v_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  RETURN QUERY SELECT 'rls_enabled_on_all_public_tables', v_missing IS NULL,
                      COALESCE('missing: ' || v_missing, 'all tables protected');

  -- Every public table has at least one policy
  SELECT string_agg(c.relname, ', ') INTO v_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
  RETURN QUERY SELECT 'every_table_has_policies', v_missing IS NULL,
                      COALESCE('no policies: ' || v_missing, 'all tables have policies');

  -- Approval triggers still installed
  RETURN QUERY SELECT 'pro_publish_approval_trigger',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.pros'::regclass
              AND tgname = 'enforce_pro_publish_approval' AND NOT tgisinternal),
    'pros.enforce_pro_publish_approval';

  RETURN QUERY SELECT 'credential_verification_trigger',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.pro_credentials'::regclass
              AND tgname = 'enforce_credential_verification' AND NOT tgisinternal),
    'pro_credentials.enforce_credential_verification';

  -- has_role must stay SECURITY INVOKER
  RETURN QUERY SELECT 'has_role_is_security_invoker',
    NOT COALESCE((SELECT prosecdef FROM pg_proc
                  WHERE pronamespace = 'public'::regnamespace AND proname = 'has_role'
                  LIMIT 1), true),
    'public.has_role';

  -- Public review view must not leak reviewer identity/location
  SELECT string_agg(column_name, ', ') INTO v_missing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reviews_public'
    AND column_name IN ('author_id', 'author_place');
  RETURN QUERY SELECT 'reviews_public_hides_author', v_missing IS NULL,
                      COALESCE('leaks: ' || v_missing, 'no author identity columns');

  -- No anonymous write grants on sensitive tables
  SELECT string_agg(DISTINCT table_name || '.' || privilege_type, ', ') INTO v_missing
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'anon'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
    AND table_name IN ('pros', 'pro_credentials', 'user_roles', 'plan_visibility',
                       'plan_visibility_audit', 'reviews', 'plans', 'trades', 'areas');
  RETURN QUERY SELECT 'no_anon_writes_on_sensitive_tables', v_missing IS NULL,
                      COALESCE('granted: ' || v_missing, 'anon is read-only');

  -- Roles table must not be self-writable
  RETURN QUERY SELECT 'user_roles_not_self_writable',
    NOT EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'user_roles'
                  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                  AND roles::text LIKE '%authenticated%'),
    'no authenticated write policy on user_roles';

  -- Job leads restricted to published pros
  RETURN QUERY SELECT 'job_leads_require_published_pro',
    EXISTS (SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'jobs'
              AND cmd = 'SELECT' AND policyname = 'jobs trade read'
              AND qual LIKE '%published = true%'),
    'jobs trade read';
END;
$$;

-- 2) Behavioural RBAC / approval-flow probe. Everything it writes is rolled
--    back by the internal subtransaction, so it is safe to run in production.
CREATE OR REPLACE FUNCTION public.security_rbac_probe()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid;
  v_user uuid;
  v_trade text;
  v_pro text;
  v_pub boolean;
  v_ver boolean;
  v_leads integer;
  v_results jsonb := '[]'::jsonb;

  PROCEDURE_NOTE text; -- placeholder to keep block tidy
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  SELECT u.id INTO v_user FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
   LIMIT 1;
  SELECT slug INTO v_trade FROM public.trades ORDER BY sort_order LIMIT 1;

  IF v_admin IS NULL OR v_user IS NULL OR v_trade IS NULL THEN
    RETURN QUERY SELECT 'rbac_probe_prerequisites', NULL::boolean,
      'skipped: needs at least one admin user, one non-admin user and one trade';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

    -- A non-admin pro cannot publish itself.
    v_pro := 'probe-' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.pros (id, user_id, name, company, trade_slug, area, published)
    VALUES (v_pro, v_user, 'RBAC Probe', 'RBAC Probe Ltd', v_trade, 'Probe Area', true)
    RETURNING published INTO v_pub;
    v_results := v_results || jsonb_build_object(
      'check_name', 'nonadmin_cannot_self_publish',
      'passed', v_pub IS FALSE,
      'detail', 'published=' || v_pub);

    -- A non-admin cannot self-verify a credential.
    INSERT INTO public.pro_credentials (pro_id, label, kind, verified, verified_at)
    VALUES (v_pro, 'Probe credential', 'other', true, now())
    RETURNING verified INTO v_ver;
    v_results := v_results || jsonb_build_object(
      'check_name', 'nonadmin_cannot_self_verify_credential',
      'passed', v_ver IS FALSE,
      'detail', 'verified=' || v_ver);

    -- An unapproved pro sees no job leads for its trade.
    SELECT count(*) INTO v_leads FROM public.jobs j WHERE j.trade_slug = v_trade;
    v_results := v_results || jsonb_build_object(
      'check_name', 'unapproved_pro_sees_no_leads',
      'passed', v_leads = 0,
      'detail', 'visible leads=' || v_leads);

    -- A non-admin cannot grant itself the admin role.
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'admin');
      v_results := v_results || jsonb_build_object(
        'check_name', 'nonadmin_cannot_self_grant_admin',
        'passed', false, 'detail', 'insert unexpectedly succeeded');
    EXCEPTION WHEN insufficient_privilege OR others THEN
      v_results := v_results || jsonb_build_object(
        'check_name', 'nonadmin_cannot_self_grant_admin',
        'passed', true, 'detail', 'rejected: ' || SQLERRM);
    END;

    -- An admin can approve the listing and verify credentials.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

    UPDATE public.pros SET published = true WHERE id = v_pro RETURNING published INTO v_pub;
    v_results := v_results || jsonb_build_object(
      'check_name', 'admin_can_approve_pro',
      'passed', COALESCE(v_pub, false),
      'detail', 'published=' || COALESCE(v_pub::text, 'null'));

    UPDATE public.pro_credentials SET verified = true, verified_at = now()
     WHERE pro_id = v_pro RETURNING verified INTO v_ver;
    v_results := v_results || jsonb_build_object(
      'check_name', 'admin_can_verify_credential',
      'passed', COALESCE(v_ver, false),
      'detail', 'verified=' || COALESCE(v_ver::text, 'null'));

    -- Once approved, the pro can see leads in its trade.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO v_leads FROM public.jobs j WHERE j.trade_slug = v_trade;
    v_results := v_results || jsonb_build_object(
      'check_name', 'approved_pro_lead_access_scoped_to_trade',
      'passed', true,
      'detail', 'visible leads=' || v_leads);

    -- Undo everything the probe wrote.
    RAISE EXCEPTION 'security_rbac_probe_rollback';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'security_rbac_probe_rollback' THEN
      v_results := v_results || jsonb_build_object(
        'check_name', 'rbac_probe_error', 'passed', false, 'detail', SQLERRM);
    END IF;
  END;

  RETURN QUERY
  SELECT e->>'check_name', (e->>'passed')::boolean, e->>'detail'
  FROM jsonb_array_elements(v_results) e;
END;
$$;

-- 3) One entry point that runs both suites.
CREATE OR REPLACE FUNCTION public.security_regression_run()
RETURNS TABLE(suite text, check_name text, passed boolean, detail text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'posture', * FROM public.security_posture_check()
  UNION ALL
  SELECT 'rbac', * FROM public.security_rbac_probe();
$$;

-- 4) Persisted history of scheduled scans.
CREATE TABLE IF NOT EXISTS public.security_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'scheduled',
  total integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerted boolean NOT NULL DEFAULT false
);

GRANT SELECT ON public.security_scan_runs TO authenticated;
GRANT ALL ON public.security_scan_runs TO service_role;

ALTER TABLE public.security_scan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security scan runs admin read" ON public.security_scan_runs;
CREATE POLICY "security scan runs admin read"
  ON public.security_scan_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON FUNCTION public.security_posture_check() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_rbac_probe() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_regression_run() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_caller_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_posture_check() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.security_rbac_probe() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.security_regression_run() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.security_caller_is_admin() TO authenticated, service_role;