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
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_area text := upper(regexp_replace(coalesce(p_postcode, ''), '[^A-Za-z]', '', 'g'));
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT p.id, p.name, p.company, p.area, p.trade_slug, p.rating, p.review_count,
           p.response_mins, p.years, p.availability, p.photo, p.day_rate,
           t.score AS trust_score,
           (t.score
            + CASE WHEN v_area <> '' AND upper(coalesce(p.postcode, '')) LIKE v_area || '%'
                   THEN 25 ELSE 0 END
            + CASE p.availability WHEN 'immediate' THEN 15 WHEN 'within_week' THEN 8
                                  WHEN 'within_month' THEN 3 ELSE 0 END)::integer AS match_score,
           (CASE p.availability
             WHEN 'immediate' THEN 'Available now'
             WHEN 'within_week' THEN 'Free within a week'
             WHEN 'within_month' THEN 'Free within a month'
             ELSE 'Currently booked up' END)::text AS reason
      FROM public.pros p
      JOIN public.pro_trust t ON t.pro_id = p.id
     WHERE p.published AND p.trade_slug = p_trade
  ) ranked
  ORDER BY ranked.match_score DESC, ranked.rating DESC, ranked.review_count DESC
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
