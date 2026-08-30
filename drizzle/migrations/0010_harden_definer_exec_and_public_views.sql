-- 1. Trigger-only SECURITY DEFINER function must not be callable by clients.
REVOKE ALL ON FUNCTION public.log_pro_feature_change() FROM PUBLIC, anon, authenticated;

-- Same treatment for every other trigger/definer helper, so a future grant
-- default cannot re-expose them.
REVOKE ALL ON FUNCTION public.log_plan_visibility_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_pro_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_owner_email() FROM PUBLIC, anon, authenticated;

-- 2. reviews_public is a read-only projection. Lock the write paths that the
--    auto-updatable view inherited, and pin the published-only filter so no
--    row that is not published can be read or written through it.
CREATE OR REPLACE VIEW public.reviews_public
WITH (security_invoker = true, security_barrier = true, check_option = cascaded) AS
  SELECT id, pro_id, author_name, rating, title, body, job_type, status, created_at
  FROM public.reviews
  WHERE status = 'published'::review_status;

REVOKE ALL ON public.reviews_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reviews_public TO anon, authenticated;
GRANT ALL ON public.reviews_public TO service_role;

-- 3. plan_visibility admin gating: assert it is role-table based, never a JWT
--    claim. Recreated idempotently with has_role() against public.user_roles.
DROP POLICY IF EXISTS "plan_visibility admin write" ON public.plan_visibility;
CREATE POLICY "plan_visibility admin write"
  ON public.plan_visibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
