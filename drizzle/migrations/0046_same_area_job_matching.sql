-- Same-area job matching. Firms are only matched when their area_slug is a
-- live area covering the job postcode. The prefix map below must mirror
-- AREA_POSTCODE_PREFIXES in src/lib/postcode-gate.ts (checked by a test).

CREATE OR REPLACE FUNCTION public.postcode_outward(p text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT CASE
    WHEN c ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' THEN left(c, length(c) - 3)
    ELSE coalesce(substring(c from '^([A-Z]{1,2}[0-9][A-Z0-9]?)'), '')
  END
  FROM (SELECT upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) AS c) s;
$$;

CREATE OR REPLACE FUNCTION public.postcode_letters(p text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(substring(upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) from '^([A-Z]{1,2})[0-9]'), '');
$$;

-- Every area whose outward-code prefixes include this postcode (overlaps included).
-- Live status is applied by callers against public.areas.
CREATE OR REPLACE FUNCTION public.area_slugs_for_postcode(p text)
RETURNS text[] LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(array_agg(m.slug ORDER BY m.ord), '{}')
  FROM (VALUES
    -- area-prefix-map:start
    (1, 'london', ARRAY['EC','WC','E','N','NW','SE','SW','W','BR','CR','DA','EN','HA','IG','KT','RM','SM','TW','UB','WD']),
    (2, 'kent', ARRAY['BR','CT','DA','ME','TN']),
    (3, 'surrey', ARRAY['CR','GU','KT','RH','SM','TW']),
    (4, 'berkshire', ARRAY['RG','SL']),
    (5, 'manchester', ARRAY['M']),
    (6, 'birmingham', ARRAY['B']),
    (7, 'bristol', ARRAY['BS']),
    (8, 'leeds', ARRAY['LS']),
    (9, 'buckinghamshire', ARRAY['HP','MK']),
    (10, 'hertfordshire', ARRAY['SG','AL','WD','EN','HP'])
    -- area-prefix-map:end
  ) AS m(ord, slug, prefixes)
  WHERE public.postcode_letters(p) <> '' AND public.postcode_letters(p) = ANY(m.prefixes);
$$;

-- Single ranked list used for both shown and saved matches.
CREATE OR REPLACE FUNCTION public.match_pros_ranked(
  p_trade text, p_postcode text, p_limit integer, p_onboarding_free boolean, p_plan_aware boolean)
RETURNS TABLE(pro_id text, name text, company text, area text, trade_slug text, rating numeric,
  review_count integer, response_mins integer, years integer, availability availability,
  photo integer, day_rate integer, trust_score integer, match_score integer, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
           (j.letters <> '' AND public.postcode_letters(p.postcode) = j.letters) AS same_letters,
           CASE WHEN p_plan_aware AND e.priority_ranking THEN 20 ELSE 0 END AS priority_bonus
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
         (s.trust_score + s.priority_bonus
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
            (s.trust_score + s.priority_bonus
             + CASE s.availability WHEN 'immediate' THEN 15 WHEN 'within_week' THEN 8
                                   WHEN 'within_month' THEN 3 ELSE 0 END) DESC,
            s.rating DESC, s.review_count DESC, s.id
   LIMIT greatest(coalesce(p_limit, 3), 1);
$$;

CREATE OR REPLACE FUNCTION public.match_pros(p_trade text, p_postcode text DEFAULT NULL::text, p_budget text DEFAULT NULL::text, p_job_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 3)
RETURNS TABLE(pro_id text, name text, company text, area text, trade_slug text, rating numeric, review_count integer, response_mins integer, years integer, availability availability, photo integer, day_rate integer, trust_score integer, match_score integer, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY SELECT * FROM public.match_pros_ranked(p_trade, p_postcode, p_limit, false, false);
  IF p_job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    INSERT INTO public.job_matches (job_id, pro_id, rank, score)
    SELECT p_job_id, r.pro_id, r.ord, r.match_score
      FROM public.match_pros_ranked(p_trade, p_postcode, p_limit, false, false)
           WITH ORDINALITY AS r(pro_id, name, company, area, trade_slug, rating, review_count, response_mins, years, availability, photo, day_rate, trust_score, match_score, reason, ord);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_pros(p_trade text, p_postcode text DEFAULT NULL::text, p_budget text DEFAULT NULL::text, p_job_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 3, p_onboarding_free boolean DEFAULT false)
RETURNS TABLE(pro_id text, name text, company text, area text, trade_slug text, rating numeric, review_count integer, response_mins integer, years integer, availability availability, photo integer, day_rate integer, trust_score integer, match_score integer, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY SELECT * FROM public.match_pros_ranked(p_trade, p_postcode, p_limit, p_onboarding_free, true);
  IF p_job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    INSERT INTO public.job_matches (job_id, pro_id, rank, score)
    SELECT p_job_id, r.pro_id, r.ord, r.match_score
      FROM public.match_pros_ranked(p_trade, p_postcode, p_limit, p_onboarding_free, true)
           WITH ORDINALITY AS r(pro_id, name, company, area, trade_slug, rating, review_count, response_mins, years, availability, photo, day_rate, trust_score, match_score, reason, ord);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_pros_ranked(text, text, integer, boolean, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_pros_ranked(text, text, integer, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.match_pros(text, text, text, uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_pros(text, text, text, uuid, integer, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_pros(text, text, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_pros(text, text, text, uuid, integer, boolean) TO service_role;
