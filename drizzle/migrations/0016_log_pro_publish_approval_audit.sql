-- Record approval / rejection of a pro listing in the same audit trail that
-- already holds featuring actions, so the admin viewer can filter all four.
CREATE OR REPLACE FUNCTION public.log_pro_publish_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email text;
  v_verified integer;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.published IS NOT DISTINCT FROM OLD.published THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT email INTO actor_email FROM auth.users WHERE id = actor;
  EXCEPTION WHEN OTHERS THEN
    actor_email := NULL;
  END;

  SELECT count(*) INTO v_verified FROM public.pro_credentials c
   WHERE c.pro_id = NEW.id AND c.verified;

  INSERT INTO public.pro_feature_audit
    (pro_id, pro_name, action, was_featured, is_featured, published,
     verified_credentials, changed_by, changed_by_email)
  VALUES
    (NEW.id, NEW.company,
     CASE WHEN NEW.published THEN 'approved' ELSE 'rejected' END,
     OLD.featured, NEW.featured, NEW.published, v_verified, actor, actor_email);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_pro_publish_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_pro_publish_change ON public.pros;
CREATE TRIGGER log_pro_publish_change
AFTER UPDATE OF published ON public.pros
FOR EACH ROW EXECUTE FUNCTION public.log_pro_publish_change();