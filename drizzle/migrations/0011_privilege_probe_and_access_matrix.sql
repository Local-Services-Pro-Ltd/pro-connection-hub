-- 1) Privilege regression suite: non-admin roles must not reach privileged
--    functions, and public views must keep their published-only filter.
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
    'public.pro_feature_audit',
    'public.plan_visibility_audit',
    'public.security_scan_runs',
    'public.form_block_events',
    'public.waiting_list',
    'public.feedback',
    'public.user_roles'
  ];
  v_tbl text;
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
        NULL; -- function absent in this environment
      END;
    END LOOP;
  END LOOP;
  RETURN QUERY SELECT 'privileged_functions_not_client_executable', v_bad IS NULL,
                      COALESCE('executable: ' || v_bad, 'no client role can execute privileged helpers');

  -- b) admin-only tables must not be writable by anon/authenticated
  v_bad := NULL;
  FOREACH v_tbl IN ARRAY v_admin_tables LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      BEGIN
        IF has_table_privilege(v_role, v_tbl, 'UPDATE')
           OR has_table_privilege(v_role, v_tbl, 'DELETE') THEN
          v_bad := concat_ws(', ', v_bad, v_role || ' -> ' || v_tbl);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
  RETURN QUERY SELECT 'admin_tables_not_client_writable', v_bad IS NULL,
                      COALESCE('writable: ' || v_bad, 'audit and control tables are read-only to clients');

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

  -- d) public pro reads only ever expose published listings
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

-- 2) Fold the new suite into the scan run used by CI and the scheduler.
CREATE OR REPLACE FUNCTION public.security_regression_run()
RETURNS TABLE(suite text, check_name text, passed boolean, detail text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'posture', * FROM public.security_posture_check()
  UNION ALL
  SELECT 'rbac', * FROM public.security_rbac_probe()
  UNION ALL
  SELECT 'privilege', * FROM public.security_privilege_probe()
  UNION ALL
  SELECT 'featured', * FROM public.featured_pro_regression();
$$;

REVOKE ALL ON FUNCTION public.security_regression_run() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_regression_run() TO authenticated, service_role;

-- 3) Admin-only access matrix: which policies and views govern each table.
CREATE OR REPLACE FUNCTION public.security_access_matrix()
RETURNS TABLE(
  object_kind text,
  object_name text,
  rls_enabled boolean,
  policy_name text,
  command text,
  roles text,
  audience text,
  expression text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    'table'::text,
    p.tablename::text,
    c.relrowsecurity,
    p.policyname::text,
    p.cmd::text,
    array_to_string(p.roles, ', '),
    CASE
      WHEN 'anon' = ANY (p.roles) THEN 'public'
      WHEN COALESCE(p.qual, '') ILIKE '%has_role(%admin%' 
        OR COALESCE(p.with_check, '') ILIKE '%has_role(%admin%' THEN 'admin only'
      WHEN COALESCE(p.qual, '') ILIKE '%auth.uid()%'
        OR COALESCE(p.with_check, '') ILIKE '%auth.uid()%' THEN 'owner only'
      ELSE 'authenticated'
    END,
    COALESCE(p.qual, p.with_check, 'true')
  FROM pg_policies p
  JOIN pg_class c ON c.relname = p.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
  WHERE p.schemaname = 'public'

  UNION ALL

  SELECT
    'table'::text,
    c.relname::text,
    c.relrowsecurity,
    NULL, NULL, NULL,
    'no policies (locked)'::text,
    NULL
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)

  UNION ALL

  SELECT
    'view'::text,
    c.relname::text,
    NULL,
    NULL,
    'SELECT'::text,
    CASE WHEN has_table_privilege('anon', n.nspname || '.' || c.relname, 'SELECT') THEN 'anon, authenticated'
         WHEN has_table_privilege('authenticated', n.nspname || '.' || c.relname, 'SELECT') THEN 'authenticated'
         ELSE 'service_role' END,
    CASE WHEN has_table_privilege('anon', n.nspname || '.' || c.relname, 'SELECT') THEN 'public' ELSE 'admin only' END,
    left(regexp_replace(pg_get_viewdef(c.oid, true), '\s+', ' ', 'g'), 400)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
  ORDER BY 1, 2, 4 NULLS FIRST;
END;
$$;

REVOKE ALL ON FUNCTION public.security_access_matrix() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_access_matrix() TO authenticated, service_role;