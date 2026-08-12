-- Trigger-only helpers should never be callable through the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.plan_visibility_touch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_pro_rating() FROM anon, authenticated, public;

-- has_role is used inside policies and by the admin UI; signed-in users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- add_to_waiting_list stays callable by anon: it is the public sign-up path.

-- Admin writes on plan_visibility must use the roles table, not JWT claims
DROP POLICY IF EXISTS "plan_visibility admin write" ON public.plan_visibility;

CREATE POLICY "plan_visibility admin write"
  ON public.plan_visibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owners can manage their own job posts
CREATE POLICY "jobs own update"
  ON public.jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs own delete"
  ON public.jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);