-- 1. Project galleries (before / after) -------------------------------------
CREATE TABLE public.pro_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  trade_slug text NOT NULL REFERENCES public.trades(slug),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  before_url text,
  after_url text,
  completed_on date,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_projects_pro_idx ON public.pro_projects (pro_id, sort_order);
CREATE INDEX pro_projects_trade_idx ON public.pro_projects (trade_slug) WHERE published;

GRANT SELECT ON public.pro_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_projects TO authenticated;
GRANT ALL ON public.pro_projects TO service_role;
ALTER TABLE public.pro_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pro_projects public read"
  ON public.pro_projects FOR SELECT TO anon, authenticated
  USING (published AND EXISTS (
    SELECT 1 FROM public.pros p WHERE p.id = pro_projects.pro_id AND p.published));

CREATE POLICY "pro_projects owner read"
  ON public.pro_projects FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p
                 WHERE p.id = pro_projects.pro_id AND p.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pro_projects owner write"
  ON public.pro_projects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p
                 WHERE p.id = pro_projects.pro_id AND p.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pros p
                 WHERE p.id = pro_projects.pro_id AND p.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

-- 2. Composite trust score ---------------------------------------------------
CREATE OR REPLACE VIEW public.pro_trust
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  p.id AS pro_id,
  p.trade_slug,
  coalesce(c.verified_count, 0) AS verified_credentials,
  coalesce(c.total_count, 0) AS total_credentials,
  LEAST(100, (
      LEAST(coalesce(c.verified_count, 0), 4) * 10
    + CASE WHEN p.review_count > 0 THEN round(p.rating / 5.0 * 25) ELSE 8 END
    + round(LEAST(p.review_count, 20) / 20.0 * 15)
    + round(LEAST(p.years, 15) / 15.0 * 10)
    + CASE WHEN p.response_mins <= 30 THEN 10
           WHEN p.response_mins <= 60 THEN 7
           WHEN p.response_mins <= 180 THEN 4 ELSE 2 END
  ))::integer AS score
FROM public.pros p
LEFT JOIN (
  SELECT pro_id,
         count(*) FILTER (WHERE verified) AS verified_count,
         count(*) AS total_count
  FROM public.pro_credentials GROUP BY pro_id
) c ON c.pro_id = p.id
WHERE p.published;

GRANT SELECT ON public.pro_trust TO anon, authenticated;

-- 3. Slot-based booking ------------------------------------------------------
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  slot_start timestamptz NOT NULL,
  duration_mins integer NOT NULL DEFAULT 60,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  postcode text,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested',
  reference text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bookings_slot_unique
  ON public.bookings (pro_id, slot_start)
  WHERE status <> 'cancelled';

GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings customer read"
  ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.pros p
                    WHERE p.id = bookings.pro_id AND p.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

-- Future taken slots, without exposing who booked them.
CREATE OR REPLACE VIEW public.pro_booked_slots
WITH (security_invoker = false, security_barrier = true) AS
SELECT pro_id, slot_start
FROM public.bookings
WHERE status <> 'cancelled' AND slot_start > now() - interval '1 day';

GRANT SELECT ON public.pro_booked_slots TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_booking(
  p_pro_id text,
  p_slot_start timestamptz,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL,
  p_postcode text DEFAULT NULL,
  p_notes text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ref text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pros WHERE id = p_pro_id AND published) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_pro');
  END IF;
  IF p_slot_start IS NULL OR p_slot_start < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slot');
  END IF;
  IF p_contact_email IS NULL OR p_contact_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;
  IF coalesce(length(trim(p_contact_name)), 0) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF NOT public.hit_rate_limit('booking:' || lower(trim(p_contact_email)), 5, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings
             WHERE pro_id = p_pro_id AND slot_start = p_slot_start AND status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_taken');
  END IF;

  INSERT INTO public.bookings (pro_id, user_id, slot_start, contact_name, contact_email,
                               contact_phone, postcode, notes)
  VALUES (p_pro_id, auth.uid(), p_slot_start,
          left(trim(p_contact_name), 80), lower(trim(p_contact_email)),
          nullif(trim(coalesce(p_contact_phone, '')), ''),
          nullif(upper(trim(coalesce(p_postcode, ''))), ''),
          left(coalesce(p_notes, ''), 2000))
  RETURNING reference INTO v_ref;

  RETURN jsonb_build_object('ok', true, 'reference', v_ref);
END;
$$;

REVOKE ALL ON FUNCTION public.request_booking(text, timestamptz, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_booking(text, timestamptz, text, text, text, text, text) TO anon, authenticated;

-- 4. Automated matching ------------------------------------------------------
CREATE TABLE public.job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_matches TO authenticated;
GRANT ALL ON public.job_matches TO service_role;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_matches owner read"
  ON public.job_matches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j
                 WHERE j.id = job_matches.job_id AND j.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.match_pros(
  p_trade text,
  p_postcode text DEFAULT NULL,
  p_budget text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 3
) RETURNS TABLE(
  pro_id text, name text, company text, area text, trade_slug text,
  rating numeric, review_count integer, response_mins integer, years integer,
  availability availability, photo integer, day_rate integer,
  trust_score integer, match_score integer, reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_area text := upper(regexp_replace(coalesce(p_postcode, ''), '[^A-Za-z]', '', 'g'));
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.company, p.area, p.trade_slug, p.rating, p.review_count,
         p.response_mins, p.years, p.availability, p.photo, p.day_rate,
         t.score,
         (t.score
          + CASE WHEN p_postcode IS NOT NULL AND v_area <> ''
                      AND upper(coalesce(p.postcode, '')) LIKE v_area || '%' THEN 25 ELSE 0 END
          + CASE p.availability WHEN 'immediate' THEN 15 WHEN 'within_week' THEN 8
                                WHEN 'within_month' THEN 3 ELSE 0 END)::integer,
         CASE p.availability
           WHEN 'immediate' THEN 'Available now'
           WHEN 'within_week' THEN 'Free within a week'
           WHEN 'within_month' THEN 'Free within a month'
           ELSE 'Currently booked up' END
    FROM public.pros p
    JOIN public.pro_trust t ON t.pro_id = p.id
   WHERE p.published AND p.trade_slug = p_trade
   ORDER BY 15 DESC, p.rating DESC, p.review_count DESC
   LIMIT greatest(coalesce(p_limit, 3), 1);

  IF p_job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    INSERT INTO public.job_matches (job_id, pro_id, rank, score)
    SELECT p_job_id, m.pro_id, row_number() OVER (ORDER BY m.score DESC), m.score
      FROM (SELECT p.id AS pro_id, t.score
              FROM public.pros p JOIN public.pro_trust t ON t.pro_id = p.id
             WHERE p.published AND p.trade_slug = p_trade
             ORDER BY t.score DESC LIMIT greatest(coalesce(p_limit, 3), 1)) m;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.match_pros(text, text, text, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.match_pros(text, text, text, uuid, integer) TO anon, authenticated;
