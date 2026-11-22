-- Firms hit "permission denied for table pros" when uploading gallery photos.
-- Signed-in users can no longer read pros.user_id (closed in the privacy
-- hardening), but ten row-level policies still looked it up directly, so every
-- "is this my firm?" check failed for the firm itself.
--
-- owns_pro() answers that one question with definer rights and exposes nothing
-- else: it returns true only when the caller is the owner of the given firm.

CREATE OR REPLACE FUNCTION public.owns_pro(p_pro_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.pros p WHERE p.id = p_pro_id AND p.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.owns_pro(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_pro(text) TO authenticated, service_role;

-- Work gallery rows
DROP POLICY IF EXISTS "pro_projects owner read" ON public.pro_projects;
CREATE POLICY "pro_projects owner read" ON public.pro_projects FOR SELECT TO authenticated
  USING (public.owns_pro(pro_id) OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "pro_projects owner write" ON public.pro_projects;
CREATE POLICY "pro_projects owner write" ON public.pro_projects FOR ALL TO authenticated
  USING (public.owns_pro(pro_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.owns_pro(pro_id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Work gallery photos: the first folder of the object name is the firm id.
DROP POLICY IF EXISTS "Owners read own pro project images" ON storage.objects;
CREATE POLICY "Owners read own pro project images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pro-projects'
         AND (public.has_role(auth.uid(), 'admin'::app_role)
              OR public.owns_pro(split_part(name, '/', 1))));
DROP POLICY IF EXISTS "Owners upload own pro project images" ON storage.objects;
CREATE POLICY "Owners upload own pro project images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pro-projects' AND public.owns_pro(split_part(name, '/', 1)));
DROP POLICY IF EXISTS "Owners delete own pro project images" ON storage.objects;
CREATE POLICY "Owners delete own pro project images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pro-projects' AND public.owns_pro(split_part(name, '/', 1)));

-- The same broken lookup in the other firm-facing policies (same rules as before).
DROP POLICY IF EXISTS "bookings customer read" ON public.bookings;
CREATE POLICY "bookings customer read" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_pro(pro_id)
         OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "availability owner manage" ON public.pro_availability;
CREATE POLICY "availability owner manage" ON public.pro_availability FOR ALL TO authenticated
  USING (public.owns_pro(pro_id)) WITH CHECK (public.owns_pro(pro_id));
DROP POLICY IF EXISTS "credentials owner all" ON public.pro_credentials;
CREATE POLICY "credentials owner all" ON public.pro_credentials FOR ALL TO authenticated
  USING (public.owns_pro(pro_id)) WITH CHECK (public.owns_pro(pro_id));
DROP POLICY IF EXISTS "Firms read leads sent to them" ON public.pro_leads;
CREATE POLICY "Firms read leads sent to them" ON public.pro_leads FOR SELECT TO authenticated
  USING (public.owns_pro(pro_id));
DROP POLICY IF EXISTS "Firms read their own applications" ON public.project_applications;
CREATE POLICY "Firms read their own applications" ON public.project_applications FOR SELECT TO authenticated
  USING (public.owns_pro(pro_id));
