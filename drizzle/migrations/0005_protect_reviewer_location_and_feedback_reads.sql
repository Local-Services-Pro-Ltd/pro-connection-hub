REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, pro_id, author_name, rating, title, body, job_type, status, created_at)
  ON public.reviews TO anon, authenticated;

DROP POLICY IF EXISTS "feedback admin read" ON public.feedback;
CREATE POLICY "feedback admin read" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.feedback TO authenticated;