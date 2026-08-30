-- SET ROLE is not permitted inside a SECURITY DEFINER function, so the
-- behavioural probe cannot become `authenticated`. Instead the approval
-- triggers honour a session-local flag that FORCES the untrusted path. The
-- flag can only make the triggers stricter, never more permissive, and only
-- superuser/definer code can set it (PostgREST clients cannot issue SET).
CREATE OR REPLACE FUNCTION public.enforce_credential_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_forced boolean := coalesce(current_setting('app.force_nonadmin', true), '') = 'on';
BEGIN
  IF NOT v_forced AND (current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN NEW;
  END IF;
  IF v_forced AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verified := false;
    NEW.verified_at := NULL;
  ELSE
    NEW.verified := OLD.verified;
    NEW.verified_at := OLD.verified_at;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_pro_publish_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_forced boolean := coalesce(current_setting('app.force_nonadmin', true), '') = 'on';
BEGIN
  IF NOT v_forced AND (current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN NEW;
  END IF;
  IF v_forced AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.published := false;
  ELSE
    NEW.published := OLD.published;
  END IF;
  RETURN NEW;
END;
$function$;

-- Probe: exercise the trigger path as a non-admin, roll everything back.
CREATE OR REPLACE FUNCTION public.security_rbac_probe()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid;
  v_trade text;
  v_pro text;
  v_pub boolean;
  v_ver boolean;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  SELECT slug INTO v_trade FROM public.trades ORDER BY sort_order LIMIT 1;

  BEGIN
    PERFORM set_config('app.force_nonadmin', 'on', true);
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

  PERFORM set_config('app.force_nonadmin', 'off', true);

  RETURN QUERY
  SELECT e->>'check_name', (e->>'passed')::boolean, e->>'detail'
  FROM jsonb_array_elements(v_results) e;
END;
$$;

REVOKE ALL ON FUNCTION public.security_rbac_probe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_rbac_probe() TO authenticated, service_role;