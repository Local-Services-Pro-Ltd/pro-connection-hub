-- ============ Admin audit log for plan visibility ============
CREATE TABLE public.plan_visibility_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_slug text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  was_public boolean,
  is_public boolean NOT NULL,
  hidden_reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_visibility_audit_created_idx
  ON public.plan_visibility_audit (created_at DESC);

GRANT SELECT ON public.plan_visibility_audit TO authenticated;
GRANT ALL ON public.plan_visibility_audit TO service_role;

ALTER TABLE public.plan_visibility_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit admin read"
  ON public.plan_visibility_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Written only by the trigger below (SECURITY DEFINER); no client write policy.

CREATE OR REPLACE FUNCTION public.log_plan_visibility_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email text;
BEGIN
  SELECT email INTO actor_email FROM auth.users WHERE id = actor;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.plan_visibility_audit
      (plan_slug, display_name, action, was_public, is_public, hidden_reason, changed_by, changed_by_email)
    VALUES
      (NEW.plan_slug, NEW.display_name, 'created', NULL, NEW.is_public, NEW.hidden_reason, actor, actor_email);
    RETURN NEW;
  END IF;

  IF NEW.is_public IS DISTINCT FROM OLD.is_public
     OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason
     OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    INSERT INTO public.plan_visibility_audit
      (plan_slug, display_name, action, was_public, is_public, hidden_reason, changed_by, changed_by_email)
    VALUES
      (NEW.plan_slug, NEW.display_name,
       CASE WHEN NEW.is_public IS DISTINCT FROM OLD.is_public
            THEN (CASE WHEN NEW.is_public THEN 'shown' ELSE 'hidden' END)
            ELSE 'edited' END,
       OLD.is_public, NEW.is_public, NEW.hidden_reason, actor, actor_email);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_plan_visibility_change() FROM anon, authenticated, public;

CREATE TRIGGER plan_visibility_audit_trg
  AFTER INSERT OR UPDATE ON public.plan_visibility
  FOR EACH ROW EXECUTE FUNCTION public.log_plan_visibility_change();

-- ============ Server-side rate limiting for public forms ============
CREATE TABLE public.form_rate_limit (
  bucket text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.form_rate_limit TO service_role;

ALTER TABLE public.form_rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable from anon/authenticated by design.

CREATE OR REPLACE FUNCTION public.hit_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hits integer;
BEGIN
  DELETE FROM public.form_rate_limit
   WHERE window_start < now() - make_interval(secs => greatest(p_window_seconds, 60) * 4);

  INSERT INTO public.form_rate_limit (bucket, hits, window_start, updated_at)
  VALUES (p_bucket, 1, now(), now())
  ON CONFLICT (bucket) DO UPDATE
    SET hits = CASE
                 WHEN public.form_rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
                 THEN 1
                 ELSE public.form_rate_limit.hits + 1
               END,
        window_start = CASE
                 WHEN public.form_rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
                 THEN now()
                 ELSE public.form_rate_limit.window_start
               END,
        updated_at = now()
  RETURNING hits INTO current_hits;

  RETURN current_hits <= p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;