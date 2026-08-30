-- 1) The behavioural RBAC probe must not run as service_role: the approval
--    triggers deliberately trust service_role, so a probe running under it can
--    never observe the non-admin path. Run phase A as the `authenticated` role
--    with a real non-admin account, exactly like a browser request.
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

  IF v_user IS NULL THEN
    v_results := v_results || jsonb_build_object(
      'check_name', 'rbac_probe', 'passed', NULL,
      'detail', 'skipped: no non-admin account exists yet');
  ELSE
    -- Phase A: approval triggers, seen by an ordinary signed-in tradesman.
    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

      v_pro := 'probe-' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.pros (id, user_id, name, company, trade_slug, area, published)
      VALUES (v_pro, v_user, 'RBAC Probe', 'RBAC Probe Ltd', v_trade, 'Probe Area', true)
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
          'check_name', 'admin_approval_path', 'passed', NULL,
          'detail', 'skipped: no admin account exists yet');
      END IF;

      RAISE EXCEPTION 'security_rbac_probe_rollback';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'security_rbac_probe_rollback' THEN
        v_results := v_results || jsonb_build_object(
          'check_name', 'rbac_probe_error', 'passed', false, 'detail', SQLERRM);
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

-- 2) The admin-table write check must look at policies, not raw grants: RLS,
--    not the GRANT, is what decides whether a client can write. Fail only when
--    a permissive UPDATE/DELETE (or unrestricted ALL) policy exists for a
--    client role on an audit / control table.
CREATE OR REPLACE FUNCTION public.security_privilege_probe()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fn text;
  v_role text;
  v_bad text := NULL;
  v_def text;
  v_privileged text[] := ARRAY[
    'public.hit_rate_limit(text,integer,integer)',
    'public.featured_pro_regression()',
    'public.log_pro_feature_change()',
    'public.log_plan_visibility_change()',
    'public.refresh_pro_rating()',
    'public.handle_new_user()',
    'public.grant_admin_for_owner_email()',
    'public.security_scan_token_matches(text)',
    'public.mark_waiting_list_email_sent(uuid)'
  ];
  v_admin_tables text[] := ARRAY[
    'pro_feature_audit',
    'plan_visibility_audit',
    'security_scan_runs',
    'form_block_events',
    'waiting_list',
    'feedback',
    'user_roles'
  ];
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- a) privileged functions are not executable by anon/authenticated
  FOREACH v_fn IN ARRAY v_privileged LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      BEGIN
        IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
          v_bad := concat_ws(', ', v_bad, v_role || ' -> ' || v_fn);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
  RETURN QUERY SELECT 'privileged_functions_not_client_executable', v_bad IS NULL,
                      COALESCE('executable: ' || v_bad, 'no client role can execute privileged helpers');

  -- b) no client-facing UPDATE/DELETE policy on audit or control tables
  SELECT string_agg(DISTINCT p.tablename || '/' || p.policyname, ', ') INTO v_bad
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = ANY (v_admin_tables)
    AND p.cmd IN ('UPDATE', 'DELETE', 'ALL')
    AND (p.roles && ARRAY['anon', 'authenticated', 'public']::name[])
    AND COALESCE(p.qual, 'true') NOT ILIKE '%has_role(%admin%';
  RETURN QUERY SELECT 'admin_tables_not_client_writable', v_bad IS NULL,
                      COALESCE('writable via: ' || v_bad, 'audit and control tables are not client-writable');

  -- c) reviews_public keeps its published-only filter and barrier options
  SELECT pg_get_viewdef('public.reviews_public'::regclass, true) INTO v_def;
  RETURN QUERY SELECT 'reviews_public_published_only',
                      v_def ILIKE '%status = ''published''%',
                      COALESCE(left(regexp_replace(v_def, '\s+', ' ', 'g'), 200), 'view missing');

  RETURN QUERY SELECT 'reviews_public_security_barrier',
                      EXISTS (
                        SELECT 1 FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relname = 'reviews_public'
                          AND array_to_string(c.reloptions, ',') ILIKE '%security_barrier=true%'
                          AND array_to_string(c.reloptions, ',') ILIKE '%security_invoker=true%'
                      ),
                      'view options';

  RETURN QUERY SELECT 'reviews_public_read_only_for_clients',
                      NOT (has_table_privilege('anon', 'public.reviews_public', 'INSERT')
                        OR has_table_privilege('authenticated', 'public.reviews_public', 'INSERT')
                        OR has_table_privilege('authenticated', 'public.reviews_public', 'UPDATE')),
                      'insert/update privileges on the public review projection';

  RETURN QUERY SELECT 'pros_public_policy_published_only',
                      EXISTS (
                        SELECT 1 FROM pg_policies
                        WHERE schemaname = 'public' AND tablename = 'pros'
                          AND 'anon' = ANY (roles) AND cmd = 'SELECT'
                          AND qual ILIKE '%published%'
                      ),
                      'anon SELECT policy on pros';
END;
$$;

REVOKE ALL ON FUNCTION public.security_privilege_probe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_privilege_probe() TO authenticated, service_role;