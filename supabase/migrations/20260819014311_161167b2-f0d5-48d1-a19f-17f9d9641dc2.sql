-- 1) has_role: SECURITY INVOKER (reads caller's own role rows via existing RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2) pros: only admins may publish
CREATE OR REPLACE FUNCTION public.enforce_pro_publish_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.published := false;
  ELSIF NEW.published IS DISTINCT FROM OLD.published THEN
    NEW.published := OLD.published;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pros_enforce_publish_approval ON public.pros;
CREATE TRIGGER pros_enforce_publish_approval
BEFORE INSERT OR UPDATE ON public.pros
FOR EACH ROW EXECUTE FUNCTION public.enforce_pro_publish_approval();

-- 3) pro_credentials: only admins may verify
CREATE OR REPLACE FUNCTION public.enforce_credential_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
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
$$;

DROP TRIGGER IF EXISTS pro_credentials_enforce_verification ON public.pro_credentials;
CREATE TRIGGER pro_credentials_enforce_verification
BEFORE INSERT OR UPDATE ON public.pro_credentials
FOR EACH ROW EXECUTE FUNCTION public.enforce_credential_verification();

-- 4) jobs trade read only for approved (published) pros
DROP POLICY IF EXISTS "jobs trade read" ON public.jobs;
CREATE POLICY "jobs trade read" ON public.jobs
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pros p
  WHERE p.user_id = auth.uid()
    AND p.trade_slug = jobs.trade_slug
    AND p.published = true
));

-- 5) reviews: hide reviewer town from anonymous public reads
DROP POLICY IF EXISTS "reviews public read" ON public.reviews;
CREATE POLICY "reviews public read" ON public.reviews
FOR SELECT TO authenticated
USING (status = 'published'::review_status);

CREATE OR REPLACE VIEW public.reviews_public
WITH (security_invoker = true) AS
SELECT id, pro_id, author_name, rating, title, body, job_type, status, created_at
FROM public.reviews
WHERE status = 'published'::review_status;

GRANT SELECT ON public.reviews_public TO anon, authenticated;