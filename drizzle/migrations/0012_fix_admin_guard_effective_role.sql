-- security_caller_is_admin() compared current_user, which inside a SECURITY
-- DEFINER function is always the function owner (postgres) — so every
-- signed-in user passed the admin guard on the security suites. Compare the
-- effective request role instead (the role PostgREST SET ROLEs into), falling
-- back to session_user for direct database sessions.
CREATE OR REPLACE FUNCTION public.security_caller_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := nullif(current_setting('role', true), '');
  IF v_role IS NULL OR v_role = 'none' THEN
    v_role := session_user;
  END IF;

  IF v_role IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.security_caller_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_caller_is_admin() TO authenticated, service_role;

-- The access matrix is admin-only; make the guard explicit at grant level too.
REVOKE ALL ON FUNCTION public.security_access_matrix() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_access_matrix() TO authenticated, service_role;