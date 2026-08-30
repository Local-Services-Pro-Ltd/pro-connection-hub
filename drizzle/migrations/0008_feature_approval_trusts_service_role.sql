-- Server-side trusted roles (service_role / migrations) count as admin for the
-- publish + feature approval gate; browser clients still need the admin role.
CREATE OR REPLACE FUNCTION public.enforce_pro_publish_approval()
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
    NEW.published := false;
    NEW.featured := false;
  ELSE
    IF NEW.published IS DISTINCT FROM OLD.published THEN
      NEW.published := OLD.published;
    END IF;
    IF NEW.featured IS DISTINCT FROM OLD.featured THEN
      NEW.featured := OLD.featured;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;