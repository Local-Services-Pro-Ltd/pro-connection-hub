CREATE OR REPLACE FUNCTION public.enforce_credential_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
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