CREATE OR REPLACE FUNCTION public.pro_plan_entitlements(
  p_pro_id text,
  p_onboarding_free boolean DEFAULT false
)
RETURNS TABLE(
  has_access boolean,
  matched_job_limit integer,
  trade_category_limit integer,
  postcode_area_limit integer,
  priority_ranking boolean,
  photo_portfolio boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.published AND (p_onboarding_free OR paid.active),
    CASE
      WHEN NOT p.published THEN 0
      WHEN p_onboarding_free THEN NULL
      WHEN paid.active AND p.plan_slug = 'starter' THEN 8
      WHEN paid.active AND p.plan_slug IN ('trade', 'contractor') THEN NULL
      ELSE 0
    END,
    CASE
      WHEN NOT p.published THEN 0
      WHEN p_onboarding_free THEN 3
      WHEN paid.active AND p.plan_slug = 'starter' THEN 1
      WHEN paid.active AND p.plan_slug = 'trade' THEN 3
      WHEN paid.active AND p.plan_slug = 'contractor' THEN NULL
      ELSE 0
    END,
    CASE
      WHEN NOT p.published THEN 0
      WHEN p_onboarding_free THEN 10
      WHEN paid.active AND p.plan_slug = 'starter' THEN 3
      WHEN paid.active AND p.plan_slug = 'trade' THEN 10
      WHEN paid.active AND p.plan_slug = 'contractor' THEN NULL
      ELSE 0
    END,
    p.published AND (p_onboarding_free OR (paid.active AND p.plan_slug IN ('trade', 'contractor'))),
    p.published AND (p_onboarding_free OR (paid.active AND p.plan_slug IN ('trade', 'contractor')))
  FROM public.pros p
  CROSS JOIN LATERAL (
    SELECT p.subscription_status IN ('active', 'trialing', 'past_due') AS active
  ) paid
  WHERE p.id = p_pro_id;
$$;

REVOKE ALL ON FUNCTION public.pro_plan_entitlements(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.pro_plan_entitlements(text, boolean) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_to_project(
  p_project_id uuid,
  p_pro_id text,
  p_user_id uuid,
  p_message text,
  p_onboarding_free boolean,
  p_quote_low integer DEFAULT NULL,
  p_quote_high integer DEFAULT NULL,
  p_available_from date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_pro public.pros;
  v_entitlement record;
  v_application_count integer;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to apply for work.';
  END IF;

  SELECT * INTO v_pro FROM public.pros WHERE id = p_pro_id;
  IF v_pro IS NULL OR v_pro.user_id IS DISTINCT FROM p_user_id OR NOT v_pro.published THEN
    RAISE EXCEPTION 'Only an approved firm profile can apply for work.';
  END IF;

  SELECT * INTO v_entitlement
  FROM public.pro_plan_entitlements(p_pro_id, p_onboarding_free);
  IF NOT COALESCE(v_entitlement.has_access, false) THEN
    RAISE EXCEPTION 'A current membership is required to apply for work.';
  END IF;

  IF v_entitlement.matched_job_limit IS NOT NULL THEN
    SELECT count(*) INTO v_application_count
    FROM public.project_applications
    WHERE pro_id = p_pro_id;
    IF v_application_count >= v_entitlement.matched_job_limit
       AND NOT EXISTS (
         SELECT 1 FROM public.project_applications
         WHERE project_id = p_project_id AND pro_id = p_pro_id
       ) THEN
      RAISE EXCEPTION 'Your matched-job allowance has been reached.';
    END IF;
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

REVOKE ALL ON FUNCTION public.apply_to_project(uuid, text, text, integer, integer, date) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_to_project(uuid, text, uuid, text, boolean, integer, integer, date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_project(uuid, text, uuid, text, boolean, integer, integer, date) TO service_role;

CREATE OR REPLACE FUNCTION public.match_pros(
  p_trade text,
  p_postcode text DEFAULT NULL,
  p_budget text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 3,
  p_onboarding_free boolean DEFAULT false
)
RETURNS TABLE(pro_id text, name text, company text, area text, trade_slug text, rating numeric, review_count integer, response_mins integer, years integer, availability availability, photo integer, day_rate integer, trust_score integer, match_score integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
            + CASE WHEN e.priority_ranking THEN 20 ELSE 0 END
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
      CROSS JOIN LATERAL public.pro_plan_entitlements(p.id, p_onboarding_free) e
     WHERE p.published AND p.trade_slug = p_trade AND e.has_access
  ) ranked
  ORDER BY ranked.match_score DESC, ranked.rating DESC, ranked.review_count DESC
  LIMIT greatest(coalesce(p_limit, 3), 1);

  IF p_job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    INSERT INTO public.job_matches (job_id, pro_id, rank, score)
    SELECT p_job_id, m.pro_id, row_number() OVER (ORDER BY m.score DESC), m.score
      FROM (SELECT p.id AS pro_id,
                   (t.score + CASE WHEN e.priority_ranking THEN 20 ELSE 0 END) AS score
              FROM public.pros p
              JOIN public.pro_trust t ON t.pro_id = p.id
              CROSS JOIN LATERAL public.pro_plan_entitlements(p.id, p_onboarding_free) e
             WHERE p.published AND p.trade_slug = p_trade AND e.has_access
             ORDER BY score DESC LIMIT greatest(coalesce(p_limit, 3), 1)) m;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.match_pros(text, text, text, uuid, integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.match_pros(text, text, text, uuid, integer, boolean) TO anon, authenticated, service_role;