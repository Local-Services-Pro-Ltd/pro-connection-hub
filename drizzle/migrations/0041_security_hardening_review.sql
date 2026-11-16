-- 1. set_question_ai: server/admin only
CREATE OR REPLACE FUNCTION public.set_question_ai(p_question_id uuid, p_answer text DEFAULT NULL::text, p_safety text DEFAULT 'none'::text, p_safety_note text DEFAULT NULL::text, p_tags text[] DEFAULT '{}'::text[], p_urgency text DEFAULT NULL::text, p_suggested_trade text DEFAULT NULL::text, p_verdict text DEFAULT 'review'::text, p_risk text DEFAULT 'low'::text, p_reasons text[] DEFAULT '{}'::text[], p_summary text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trade text := nullif(btrim(coalesce(p_suggested_trade, '')), '');
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR session_user = 'service_role'
          OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.questions q
     SET ai_answer = nullif(btrim(coalesce(p_answer, '')), ''),
         ai_answer_at = now(),
         ai_safety = CASE WHEN p_safety IN ('none','caution','high') THEN p_safety ELSE 'none' END,
         ai_safety_note = nullif(btrim(coalesce(p_safety_note, '')), ''),
         ai_tags = coalesce(p_tags, '{}'),
         ai_urgency = nullif(btrim(coalesce(p_urgency, '')), ''),
         ai_suggested_trade = v_trade,
         trade_slug = COALESCE(q.trade_slug, (SELECT t.slug FROM public.trades t WHERE t.slug = v_trade))
   WHERE q.id = p_question_id;

  INSERT INTO public.question_ai_reviews (question_id, verdict, risk, reasons, summary)
  VALUES (
    p_question_id,
    CASE WHEN p_verdict IN ('publish','review','reject') THEN p_verdict ELSE 'review' END,
    CASE WHEN p_risk IN ('low','medium','high') THEN p_risk ELSE 'low' END,
    coalesce(p_reasons, '{}'),
    nullif(btrim(coalesce(p_summary, '')), '')
  )
  ON CONFLICT (question_id) DO UPDATE
     SET verdict = EXCLUDED.verdict, risk = EXCLUDED.risk, reasons = EXCLUDED.reasons,
         summary = EXCLUDED.summary, created_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_question_ai(uuid,text,text,text,text[],text,text,text,text,text[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_question_ai(uuid,text,text,text,text[],text,text,text,text,text[],text) TO service_role;

-- 2. answer_question: caller identity from auth.uid()
DROP FUNCTION IF EXISTS public.answer_question(uuid, uuid, text);
CREATE FUNCTION public.answer_question(p_question_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pro public.pros%ROWTYPE;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF length(v_body) < 20 OR length(v_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body';
  END IF;

  SELECT * INTO v_pro FROM public.pros WHERE user_id = v_uid AND published = true LIMIT 1;
  IF v_pro.id IS NULL THEN
    RAISE EXCEPTION 'not_a_published_pro';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = p_question_id AND q.status = 'published') THEN
    RAISE EXCEPTION 'question_not_available';
  END IF;

  IF EXISTS (SELECT 1 FROM public.answers a WHERE a.question_id = p_question_id AND a.pro_id = v_pro.id) THEN
    RAISE EXCEPTION 'already_answered';
  END IF;

  INSERT INTO public.answers (question_id, pro_id, author_name, body)
  VALUES (p_question_id, v_pro.id, v_pro.company, v_body)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.answer_question(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_question(uuid, text) TO authenticated, service_role;

-- 3. Column-level read restrictions (anon + authenticated); service_role keeps all
REVOKE SELECT ON public.pros FROM anon, authenticated;
GRANT SELECT (id, name, company, trade_slug, area, area_slug, postcode, bio, years, response_mins,
  day_rate, min_job_budget, availability, services, photo, published, rating, review_count,
  created_at, updated_at, featured, is_demo, plan_slug) ON public.pros TO anon, authenticated;

REVOKE SELECT ON public.projects FROM anon, authenticated;
GRANT SELECT (id, title, description, trade_slug, postcode, area, budget_min, budget_max,
  start_date, end_date, photos, status, reference, created_at, updated_at) ON public.projects TO anon, authenticated;

-- 4. Scoped public read rules
DROP POLICY IF EXISTS "plans public read" ON public.plans;
CREATE POLICY "plans public read" ON public.plans FOR SELECT TO anon, authenticated USING (visible = true);

DROP POLICY IF EXISTS "trades public read" ON public.trades;
CREATE POLICY "trades public read" ON public.trades FOR SELECT TO anon, authenticated USING (sort_order >= 0 AND length(name) > 0);

DROP POLICY IF EXISTS "areas public read" ON public.areas;
CREATE POLICY "areas public read" ON public.areas FOR SELECT TO anon, authenticated USING (status IN ('live', 'coming_soon'));

DROP POLICY IF EXISTS "plan_visibility public read" ON public.plan_visibility;
CREATE POLICY "plan_visibility public read" ON public.plan_visibility FOR SELECT TO anon, authenticated
  USING (is_public = true OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Hero image settings are public" ON public.trade_hero_images;
CREATE POLICY "Hero image settings are public" ON public.trade_hero_images FOR SELECT TO anon, authenticated
  USING (image_url IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can send feedback" ON public.feedback;
CREATE POLICY "Anyone can send feedback" ON public.feedback FOR INSERT TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND length(btrim(name)) BETWEEN 1 AND 200
    AND length(btrim(email)) BETWEEN 3 AND 320
    AND length(btrim(message)) BETWEEN 1 AND 5000
  );

-- 5. Storage: no public/listing reads; admins (and gallery owners) only
DROP POLICY IF EXISTS "Pro project images are readable" ON storage.objects;
DROP POLICY IF EXISTS "Trade hero images are readable" ON storage.objects;
CREATE POLICY "Admins read pro project images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pro-projects' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read trade hero images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-heroes' AND public.has_role(auth.uid(), 'admin'));