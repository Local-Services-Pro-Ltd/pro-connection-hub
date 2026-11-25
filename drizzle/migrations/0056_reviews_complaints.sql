-- Release C of the product plan: after the job.
--
--   reviews          now tied to a job, with five ratings and a "verified job"
--                    flag. Written only by the server after it has checked the
--                    homeowner's private job link and that the firm was chosen
--                    and the work marked complete.
--   review_replies   one public reply from the firm, moderated like a review.
--   complaints       a problem reported by a homeowner about a job and firm.
--
-- The two new tables have row level security on with no policies and no
-- browser privileges: every read and write goes through server functions.
-- The new review columns are not granted to the browser roles either, so the
-- existing public view is unchanged; the server returns them for published
-- reviews only.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality smallint CHECK (quality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS punctuality smallint CHECK (punctuality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS communication smallint CHECK (communication BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS cleanliness smallint CHECK (cleanliness BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS price_accuracy smallint CHECK (price_accuracy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS verified_job boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_reason text CHECK (report_reason IS NULL OR length(report_reason) <= 1000),
  ADD COLUMN IF NOT EXISTS moderation_note text CHECK (moderation_note IS NULL OR length(moderation_note) <= 1000),
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

-- One review per job and firm.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_job_pro_key
  ON public.reviews (job_id, pro_id) WHERE job_id IS NOT NULL;

-- New reviews wait for a decision; nothing publishes itself.
ALTER TABLE public.reviews ALTER COLUMN status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE
    DEFAULT ('TFR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_reference text,
  pro_id text REFERENCES public.pros(id) ON DELETE SET NULL,
  category text NOT NULL
    CHECK (category IN ('not_started', 'abandoned', 'poor_quality', 'overcharged', 'conduct', 'other')),
  description text NOT NULL CHECK (length(description) BETWEEN 20 AND 4000),
  desired_outcome text NOT NULL DEFAULT '' CHECK (length(desired_outcome) <= 1500),
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'firm_asked', 'resolved', 'closed')),
  firm_asked_at timestamptz,
  firm_response text CHECK (firm_response IS NULL OR length(firm_response) <= 4000),
  admin_notes text CHECK (admin_notes IS NULL OR length(admin_notes) <= 4000),
  resolution text CHECK (resolution IS NULL OR length(resolution) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON public.complaints (status, created_at);

ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_replies, public.complaints FROM anon, authenticated;
GRANT ALL ON public.review_replies, public.complaints TO service_role;

-- Reviews are now written and moderated only by the server, so a signed-in
-- user must not be able to edit review rows (including the new flags).
REVOKE UPDATE ON public.reviews FROM authenticated;

-- Example listings must never be offered to a real homeowner as a match.
CREATE OR REPLACE FUNCTION public.match_pros_ranked(p_trade text, p_postcode text, p_limit integer, p_onboarding_free boolean, p_plan_aware boolean)
 RETURNS TABLE(pro_id text, name text, company text, area text, trade_slug text, rating numeric, review_count integer, response_mins integer, years integer, availability availability, photo integer, day_rate integer, trust_score integer, match_score integer, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH job AS (
    SELECT public.postcode_outward(p_postcode) AS outward,
           public.postcode_letters(p_postcode) AS letters,
           ARRAY(SELECT a.slug FROM public.areas a
                  WHERE a.status = 'live'
                    AND a.slug = ANY(public.area_slugs_for_postcode(p_postcode))) AS live_areas
  ), scored AS (
    SELECT p.id, p.name, p.company, p.area, p.trade_slug, p.rating, p.review_count,
           p.response_mins, p.years, p.availability, p.photo, p.day_rate,
           t.score AS trust_score,
           (j.outward <> '' AND public.postcode_outward(p.postcode) = j.outward) AS same_outward,
           (j.letters <> '' AND public.postcode_letters(p.postcode) = j.letters) AS same_letters
      FROM public.pros p
      JOIN public.pro_trust t ON t.pro_id = p.id
      CROSS JOIN job j
      LEFT JOIN LATERAL public.pro_plan_entitlements(p.id, p_onboarding_free) e ON p_plan_aware
     WHERE p.published AND NOT coalesce(p.is_demo, false) AND p.trade_slug = p_trade
       AND p.area_slug = ANY(j.live_areas)
       AND (NOT p_plan_aware OR coalesce(e.has_access, false))
  )
  SELECT s.id, s.name, s.company, s.area, s.trade_slug, s.rating, s.review_count,
         s.response_mins, s.years, s.availability, s.photo, s.day_rate, s.trust_score,
         (s.trust_score
          + CASE WHEN s.same_outward THEN 35 WHEN s.same_letters THEN 25 ELSE 0 END
          + CASE s.availability WHEN 'immediate' THEN 15 WHEN 'within_week' THEN 8
                                WHEN 'within_month' THEN 3 ELSE 0 END)::integer,
         (CASE s.availability
           WHEN 'immediate' THEN 'Available now'
           WHEN 'within_week' THEN 'Free within a week'
           WHEN 'within_month' THEN 'Free within a month'
           ELSE 'Currently booked up' END)::text
    FROM scored s
   ORDER BY s.same_outward DESC, s.same_letters DESC,
            (s.trust_score
             + CASE s.availability WHEN 'immediate' THEN 15 WHEN 'within_week' THEN 8
                                   WHEN 'within_month' THEN 3 ELSE 0 END) DESC,
            s.rating DESC, s.review_count DESC, s.id
   LIMIT greatest(coalesce(p_limit, 3), 1);
$function$;
