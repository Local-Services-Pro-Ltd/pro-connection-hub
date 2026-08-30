-- The behavioural probe now always exercises the approval triggers (which do
-- not need real accounts) and additionally exercises the RLS layer whenever an
-- admin and a non-admin account exist. Everything it writes is rolled back.
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
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  SELECT u.id INTO v_user FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
   LIMIT 1;
  SELECT slug INTO v_trade FROM public.trades ORDER BY sort_order LIMIT 1;

  -- Phase A: approval triggers, no accounts required (auth.uid() is NULL, i.e.
  -- "not an admin"), so this runs on every environment.
  BEGIN
    PERFORM set_config('request.jwt.claims', NULL, true);

    v_pro := 'probe-' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.pros (id, user_id, name, company, trade_slug, area, published)
    VALUES (v_pro, NULL, 'RBAC Probe', 'RBAC Probe Ltd', v_trade, 'Probe Area', true)
    RETURNING published INTO v_pub;
    v_results := v_results || jsonb_build_object(
      'check_name', 'nonadmin_cannot_self_publish',
      'passed', v_pub IS FALSE,
      'detail', 'insert with published=true stored published=' || v_pub);

    UPDATE public.pros SET published = true WHERE id = v_pro RETURNING published INTO v_pub;
    v_results := v_results || jsonb_build_object(
      'check_name', 'nonadmin_cannot_flip_published',
      'passed', v_pub IS FALSE,
      'detail', 'update to published=true stored published=' || v_pub);

    INSERT INTO public.pro_credentials (pro_id, label, kind, verified, verified_at)
    VALUES (v_pro, 'Probe credential', 'other', true, now())
    RETURNING verified INTO v_ver;
    v_results := v_results || jsonb_build_object(
      'check_name', 'nonadmin_cannot_self_verify_credential',
      'passed', v_ver IS FALSE,
      'detail', 'insert with verified=true stored verified=' || v_ver);

    IF v_admin IS NOT NULL THEN
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
    ELSE
      v_results := v_results || jsonb_build_object(
        'check_name', 'admin_approval_path',
        'passed', NULL,
        'detail', 'skipped: no admin account exists yet');
    END IF;

    RAISE EXCEPTION 'security_rbac_probe_rollback';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'security_rbac_probe_rollback' THEN
      v_results := v_results || jsonb_build_object(
        'check_name', 'rbac_trigger_probe_error', 'passed', false, 'detail', SQLERRM);
    END IF;
  END;

  -- Phase B: RLS layer, needs a real non-admin account.
  IF v_user IS NULL THEN
    v_results := v_results || jsonb_build_object(
      'check_name', 'rls_lead_access_probe', 'passed', NULL,
      'detail', 'skipped: no non-admin account exists yet');
  ELSE
    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

      v_pro := 'probe-' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.pros (id, user_id, name, company, trade_slug, area, published)
      VALUES (v_pro, v_user, 'RBAC Probe', 'RBAC Probe Ltd', v_trade, 'Probe Area', true);

      SELECT count(*) INTO v_leads FROM public.jobs j WHERE j.trade_slug = v_trade;
      v_results := v_results || jsonb_build_object(
        'check_name', 'unapproved_pro_sees_no_leads',
        'passed', v_leads = 0,
        'detail', 'visible leads=' || v_leads);

      BEGIN
        INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'admin');
        v_results := v_results || jsonb_build_object(
          'check_name', 'nonadmin_cannot_self_grant_admin',
          'passed', false, 'detail', 'insert unexpectedly succeeded');
      EXCEPTION WHEN OTHERS THEN
        v_results := v_results || jsonb_build_object(
          'check_name', 'nonadmin_cannot_self_grant_admin',
          'passed', true, 'detail', 'rejected: ' || SQLERRM);
      END;

      RAISE EXCEPTION 'security_rbac_probe_rollback';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'security_rbac_probe_rollback' THEN
        v_results := v_results || jsonb_build_object(
          'check_name', 'rbac_rls_probe_error', 'passed', false, 'detail', SQLERRM);
      END IF;
    END;
  END IF;

  RETURN QUERY
  SELECT e->>'check_name', (e->>'passed')::boolean, e->>'detail'
  FROM jsonb_array_elements(v_results) e;
END;
$$;

REVOKE ALL ON FUNCTION public.security_rbac_probe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_rbac_probe() TO authenticated, service_role;