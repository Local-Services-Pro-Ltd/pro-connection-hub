CREATE OR REPLACE FUNCTION public.enforce_project_publish_approval()
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
  ELSE
    NEW.published := OLD.published;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pro_projects_enforce_publish ON public.pro_projects;
CREATE TRIGGER pro_projects_enforce_publish
  BEFORE INSERT OR UPDATE ON public.pro_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_publish_approval();

REVOKE EXECUTE ON FUNCTION public.enforce_project_publish_approval() FROM anon, authenticated, public;