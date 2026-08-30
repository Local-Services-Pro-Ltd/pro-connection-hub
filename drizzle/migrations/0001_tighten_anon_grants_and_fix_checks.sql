-- Least privilege: anon never needs write access to catalogue, listing,
-- review, role or plan tables. RLS already blocked these writes; removing the
-- grants closes the gap at the privilege layer too.
REVOKE INSERT, UPDATE, DELETE ON public.trades FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.areas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plan_visibility FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plan_visibility_audit FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pros FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pro_credentials FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE ALL ON public.form_rate_limit FROM anon, authenticated;
REVOKE ALL ON public.form_block_events FROM anon;

-- Corrected posture checks: match triggers by their function, and treat a
-- fully locked table (no policies AND no client grants) as intentional.
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

  SELECT string_agg(c.relname, ', ') INTO v_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  RETURN QUERY SELECT 'rls_enabled_on_all_public_tables', v_missing IS NULL,
                      COALESCE('missing: ' || v_missing, 'all tables protected');

  -- A table reachable by anon/authenticated must have policies; a table with
  -- no client grants at all is deliberately server-only.
  SELECT string_agg(c.relname, ', ') INTO v_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
    AND EXISTS (
      SELECT 1 FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = c.relname
        AND g.grantee IN ('anon', 'authenticated'));
  RETURN QUERY SELECT 'client_reachable_tables_have_policies', v_missing IS NULL,
                      COALESCE('no policies: ' || v_missing, 'all reachable tables have policies');

  RETURN QUERY SELECT 'pro_publish_approval_trigger',
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE t.tgrelid = 'public.pros'::regclass AND NOT t.tgisinternal
              AND p.proname = 'enforce_pro_publish_approval'),
    'pros: publish requires admin';

  RETURN QUERY SELECT 'credential_verification_trigger',
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE t.tgrelid = 'public.pro_credentials'::regclass AND NOT t.tgisinternal
              AND p.proname = 'enforce_credential_verification'),
    'pro_credentials: verification requires admin';

  RETURN QUERY SELECT 'has_role_is_security_invoker',
    NOT COALESCE((SELECT prosecdef FROM pg_proc
                  WHERE pronamespace = 'public'::regnamespace AND proname = 'has_role'
                  LIMIT 1), true),
    'public.has_role';

  SELECT string_agg(column_name, ', ') INTO v_missing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reviews_public'
    AND column_name IN ('author_id', 'author_place');
  RETURN QUERY SELECT 'reviews_public_hides_author', v_missing IS NULL,
                      COALESCE('leaks: ' || v_missing, 'no author identity columns');

  SELECT string_agg(DISTINCT table_name || '.' || privilege_type, ', ') INTO v_missing
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'anon'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
    AND table_name IN ('pros', 'pro_credentials', 'user_roles', 'plan_visibility',
                       'plan_visibility_audit', 'reviews', 'plans', 'trades', 'areas');
  RETURN QUERY SELECT 'no_anon_writes_on_sensitive_tables', v_missing IS NULL,
                      COALESCE('granted: ' || v_missing, 'anon is read-only');

  RETURN QUERY SELECT 'user_roles_not_client_writable',
    NOT EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'user_roles'
                  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                  AND roles::text LIKE '%authenticated%')
    AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'user_roles'
                      AND grantee = 'anon'),
    'roles are admin-managed only';

  RETURN QUERY SELECT 'job_leads_require_published_pro',
    EXISTS (SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'jobs'
              AND cmd = 'SELECT' AND policyname = 'jobs trade read'
              AND qual LIKE '%published = true%'),
    'jobs trade read';
END;
$$;

REVOKE ALL ON FUNCTION public.security_posture_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_posture_check() TO authenticated, service_role;