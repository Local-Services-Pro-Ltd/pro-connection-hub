-- Release A of the product plan: make the site match what it says.
--
-- 1. Ranking cannot be bought. Matching added 20 points for firms on a plan
--    with "priority ranking". Remove it: order now depends only on distance,
--    credential trust score, availability, then rating and review count.
--    Plan access (has_access) still decides who can receive matches at all.
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
     WHERE p.published AND p.trade_slug = p_trade
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

-- 2. Reviews must come from a job. Until the job-linked review step ships,
--    nobody can insert a review from the browser: any signed-in user could
--    previously review any firm. There are no reviews to migrate.
DROP POLICY IF EXISTS "reviews own insert" ON public.reviews;
REVOKE INSERT ON public.reviews FROM authenticated;

-- 3. Stop advertising it: the Trade plan listed "Priority ranking".
UPDATE public.plans
   SET features = array_remove(features, 'Priority ranking'), updated_at = now()
 WHERE 'Priority ranking' = ANY(features);
