-- 1. Firm contact address used to route homeowner leads.
ALTER TABLE public.pros ADD COLUMN IF NOT EXISTS contact_email text;

-- 2. Direct leads from homeowners to a specific firm.
CREATE TABLE public.pro_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL REFERENCES public.pros(id),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  postcode text NOT NULL,
  trade_slug text REFERENCES public.trades(slug),
  message text NOT NULL,
  budget_band text,
  timing text,
  status text NOT NULL DEFAULT 'new',
  reference text NOT NULL,
  delivered_to_firm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_leads_pro_idx ON public.pro_leads(pro_id, created_at DESC);
CREATE INDEX pro_leads_user_idx ON public.pro_leads(user_id, created_at DESC);

GRANT SELECT ON public.pro_leads TO authenticated;
GRANT ALL ON public.pro_leads TO service_role;
ALTER TABLE public.pro_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners read their own leads"
  ON public.pro_leads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Firms read leads sent to them"
  ON public.pro_leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_leads.pro_id AND p.user_id = auth.uid()));
CREATE POLICY "Admins read all leads"
  ON public.pro_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Homeowner project postings with budget, dates and photos.
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text NOT NULL,
  trade_slug text REFERENCES public.trades(slug),
  postcode text NOT NULL,
  area text,
  budget_min integer,
  budget_max integer,
  start_date date,
  end_date date,
  photos text[] NOT NULL DEFAULT '{}',
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reference text NOT NULL DEFAULT ('TFP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8))),
  notify_applications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_status_idx ON public.projects(status, created_at DESC);
CREATE INDEX projects_user_idx ON public.projects(user_id, created_at DESC);

GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published projects are public"
  ON public.projects FOR SELECT TO anon, authenticated
  USING (status = 'published');
CREATE POLICY "Owners read their own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins read every project"
  ON public.projects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners post their own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update their own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any project"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Publication is an admin decision: a homeowner can edit their posting but
-- never move it into the public board themselves.
CREATE OR REPLACE FUNCTION public.enforce_project_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    RETURN NEW;
  END IF;

  NEW.updated_at := now();

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT (OLD.status = 'published' AND NEW.status = 'closed')
  THEN
    RAISE EXCEPTION 'Only an administrator can change a posting''s review status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_review_guard
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_review();

-- 4. Firm applications against a published posting.
CREATE TABLE public.project_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES public.pros(id),
  message text NOT NULL,
  quote_low integer,
  quote_high integer,
  available_from date,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, pro_id)
);
CREATE INDEX project_applications_project_idx ON public.project_applications(project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.project_applications TO authenticated;
GRANT ALL ON public.project_applications TO service_role;
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners read applications on their postings"
  ON public.project_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects pj WHERE pj.id = project_applications.project_id AND pj.user_id = auth.uid()));
CREATE POLICY "Firms read their own applications"
  ON public.project_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = project_applications.pro_id AND p.user_id = auth.uid()));
CREATE POLICY "Admins read all applications"
  ON public.project_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Homeowners update applications on their postings"
  ON public.project_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects pj WHERE pj.id = project_applications.project_id AND pj.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects pj WHERE pj.id = project_applications.project_id AND pj.user_id = auth.uid()));

-- Only a published, verified firm may apply, and only to a live posting.
CREATE OR REPLACE FUNCTION public.apply_to_project(
  p_project_id uuid,
  p_pro_id text,
  p_message text,
  p_quote_low integer DEFAULT NULL,
  p_quote_high integer DEFAULT NULL,
  p_available_from date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_pro public.pros;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to apply for work.';
  END IF;

  SELECT * INTO v_pro FROM public.pros WHERE id = p_pro_id;
  IF v_pro IS NULL OR v_pro.user_id IS DISTINCT FROM auth.uid() OR NOT v_pro.published THEN
    RAISE EXCEPTION 'Only a verified firm profile can apply for work.';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_project IS NULL OR v_project.status <> 'published' THEN
    RAISE EXCEPTION 'That posting is no longer accepting applications.';
  END IF;

  IF length(coalesce(trim(p_message), '')) < 20 THEN
    RAISE EXCEPTION 'Tell the homeowner a little more about how you would approach the job.';
  END IF;

  INSERT INTO public.project_applications (project_id, pro_id, message, quote_low, quote_high, available_from)
  VALUES (p_project_id, p_pro_id, trim(p_message), p_quote_low, p_quote_high, p_available_from)
  ON CONFLICT (project_id, pro_id)
  DO UPDATE SET message = EXCLUDED.message,
                quote_low = EXCLUDED.quote_low,
                quote_high = EXCLUDED.quote_high,
                available_from = EXCLUDED.available_from
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'reference', v_project.reference);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_to_project(uuid, text, text, integer, integer, date) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_to_project(uuid, text, text, integer, integer, date) TO authenticated;

-- Public counter so the board can show interest without exposing applicants.
CREATE OR REPLACE FUNCTION public.project_application_counts()
RETURNS TABLE(project_id uuid, applications bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pa.project_id, count(*)
  FROM public.project_applications pa
  JOIN public.projects pj ON pj.id = pa.project_id AND pj.status = 'published'
  GROUP BY pa.project_id;
$$;
GRANT EXECUTE ON FUNCTION public.project_application_counts() TO anon, authenticated;

-- 5. Saved searches for signed-in homeowners.
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  trade_slug text,
  area text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_searches_user_idx ON public.saved_searches(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their saved searches"
  ON public.saved_searches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
