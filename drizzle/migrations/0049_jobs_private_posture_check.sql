-- The posture check "job_leads_require_published_pro" asserted that the
-- "jobs trade read" policy existed. 0047 removed that policy on purpose (firms
-- could read every homeowner's job and contact details), so the nightly scan
-- flagged it. Replace the check with its successor: jobs are readable only by
-- their owner or an admin.
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

  SELECT string_agg(c.relname, ', ') INTO v_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
    AND EXISTS (
      SELECT 1 FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = c.relname
        AND g.grantee IN ('anon', 'authenticated')
        AND g.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE'));
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

  SELECT string_agg(DISTINCT grantee || ':' || privilege_type, ', ') INTO v_missing
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'user_roles'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  RETURN QUERY SELECT 'user_roles_not_client_writable',
    v_missing IS NULL
    AND NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'user_roles'
                      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                      AND roles::text LIKE '%authenticated%'),
    COALESCE('granted: ' || v_missing, 'roles are admin-managed only');

  -- Since 0047 firms never read jobs directly: they see a safe view through
  -- server functions, and only the job's owner (or an admin) can SELECT rows.
  RETURN QUERY SELECT 'jobs_private_to_owner',
    NOT EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'jobs'
                  AND cmd IN ('SELECT', 'ALL')
                  AND roles::text ~ '(authenticated|anon|public)'
                  AND policyname <> 'jobs own read'
                  AND coalesce(qual, '') NOT LIKE '%has_role%'),
    'only the job owner or an admin can read jobs';
END;
$$;

REVOKE ALL ON FUNCTION public.security_posture_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_posture_check() TO authenticated, service_role;
