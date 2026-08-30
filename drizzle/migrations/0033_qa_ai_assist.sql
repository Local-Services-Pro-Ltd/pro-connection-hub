-- AI assistance for Ask the Pros: labelled AI first-pass answers, auto-tagging,
-- moderation assist (admin-only) and related-question search.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS ai_answer text,
  ADD COLUMN IF NOT EXISTS ai_answer_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_safety text NOT NULL DEFAULT 'none'
    CHECK (ai_safety IN ('none','caution','high')),
  ADD COLUMN IF NOT EXISTS ai_safety_note text,
  ADD COLUMN IF NOT EXISTS ai_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_urgency text,
  ADD COLUMN IF NOT EXISTS ai_suggested_trade text;

CREATE TABLE IF NOT EXISTS public.question_ai_reviews (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  verdict text NOT NULL DEFAULT 'review' CHECK (verdict IN ('publish','review','reject')),
  risk text NOT NULL DEFAULT 'low' CHECK (risk IN ('low','medium','high')),
  reasons text[] NOT NULL DEFAULT '{}',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.question_ai_reviews TO authenticated;
GRANT ALL ON public.question_ai_reviews TO service_role;

ALTER TABLE public.question_ai_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read AI reviews" ON public.question_ai_reviews;
CREATE POLICY "Admins read AI reviews"
  ON public.question_ai_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_question_ai(
  p_question_id uuid,
  p_answer text DEFAULT NULL,
  p_safety text DEFAULT 'none',
  p_safety_note text DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
  p_urgency text DEFAULT NULL,
  p_suggested_trade text DEFAULT NULL,
  p_verdict text DEFAULT 'review',
  p_risk text DEFAULT 'low',
  p_reasons text[] DEFAULT '{}',
  p_summary text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trade text := nullif(btrim(coalesce(p_suggested_trade, '')), '');
BEGIN
  UPDATE public.questions q
     SET ai_answer = nullif(btrim(coalesce(p_answer, '')), ''),
         ai_answer_at = now(),
         ai_safety = CASE WHEN p_safety IN ('none','caution','high') THEN p_safety ELSE 'none' END,
         ai_safety_note = nullif(btrim(coalesce(p_safety_note, '')), ''),
         ai_tags = coalesce(p_tags, '{}'),
         ai_urgency = nullif(btrim(coalesce(p_urgency, '')), ''),
         ai_suggested_trade = v_trade,
         trade_slug = COALESCE(
           q.trade_slug,
           (SELECT t.slug FROM public.trades t WHERE t.slug = v_trade)
         )
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
     SET verdict = EXCLUDED.verdict,
         risk = EXCLUDED.risk,
         reasons = EXCLUDED.reasons,
         summary = EXCLUDED.summary,
         created_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.set_question_ai(uuid, text, text, text, text[], text, text, text, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_question_ai(uuid, text, text, text, text[], text, text, text, text, text[], text) TO service_role;

CREATE OR REPLACE FUNCTION public.search_questions(p_query text, p_limit int DEFAULT 5)
RETURNS TABLE(
  id uuid,
  title text,
  trade_slug text,
  answer_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT q.id, q.title, q.trade_slug,
         (SELECT count(*) FROM public.answers a
           WHERE a.question_id = q.id AND a.status = 'published') AS answer_count
    FROM public.questions q
   WHERE q.status = 'published'
     AND length(btrim(coalesce(p_query, ''))) >= 4
     AND (
       q.title ILIKE '%' || btrim(p_query) || '%'
       OR q.body ILIKE '%' || btrim(p_query) || '%'
     )
   ORDER BY q.published_at DESC NULLS LAST
   LIMIT least(greatest(coalesce(p_limit, 5), 1), 20);
$function$;

GRANT EXECUTE ON FUNCTION public.search_questions(text, int) TO anon, authenticated;