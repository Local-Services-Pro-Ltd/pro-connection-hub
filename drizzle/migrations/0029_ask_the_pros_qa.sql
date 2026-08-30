-- Ask the Pros: moderated public Q&A between homeowners and vetted trades.

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_slug text REFERENCES public.trades(slug) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  asker_name text NOT NULL DEFAULT 'A homeowner',
  area text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  pro_id text REFERENCES public.pros(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX questions_status_idx ON public.questions(status, published_at DESC);
CREATE INDEX answers_question_idx ON public.answers(question_id, status);

GRANT SELECT ON public.questions TO anon, authenticated;
GRANT SELECT ON public.answers TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
GRANT ALL ON public.answers TO service_role;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published questions are public"
  ON public.questions FOR SELECT
  USING (status = 'published');

CREATE POLICY "Published answers are public"
  ON public.answers FOR SELECT
  USING (status = 'published' AND EXISTS (
    SELECT 1 FROM public.questions q
     WHERE q.id = answers.question_id AND q.status = 'published'
  ));

CREATE POLICY "Admins manage questions"
  ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage answers"
  ON public.answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.ask_question(
  p_title text,
  p_body text,
  p_trade_slug text DEFAULT NULL,
  p_asker_name text DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF length(v_title) < 10 OR length(v_title) > 160 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;
  IF length(v_body) < 20 OR length(v_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body';
  END IF;

  INSERT INTO public.questions (title, body, trade_slug, asker_name, area)
  VALUES (
    v_title,
    v_body,
    nullif(btrim(coalesce(p_trade_slug, '')), ''),
    coalesce(nullif(btrim(coalesce(p_asker_name, '')), ''), 'A homeowner'),
    nullif(btrim(coalesce(p_area, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ask_question(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ask_question(text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.answer_question(
  p_question_id uuid,
  p_user_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pro public.pros%ROWTYPE;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF length(v_body) < 20 OR length(v_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body';
  END IF;

  SELECT * INTO v_pro FROM public.pros
   WHERE user_id = p_user_id AND published = true
   LIMIT 1;

  IF v_pro.id IS NULL THEN
    RAISE EXCEPTION 'not_a_published_pro';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.questions q
     WHERE q.id = p_question_id AND q.status = 'published'
  ) THEN
    RAISE EXCEPTION 'question_not_available';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.answers a
     WHERE a.question_id = p_question_id AND a.pro_id = v_pro.id
  ) THEN
    RAISE EXCEPTION 'already_answered';
  END IF;

  INSERT INTO public.answers (question_id, pro_id, author_name, body)
  VALUES (p_question_id, v_pro.id, v_pro.company, v_body)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.answer_question(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.answer_question(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.public_questions(p_trade text DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS TABLE(
  id uuid,
  title text,
  body text,
  trade_slug text,
  asker_name text,
  area text,
  published_at timestamptz,
  answer_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT q.id, q.title, q.body, q.trade_slug, q.asker_name, q.area, q.published_at,
         (SELECT count(*) FROM public.answers a
           WHERE a.question_id = q.id AND a.status = 'published') AS answer_count
    FROM public.questions q
   WHERE q.status = 'published'
     AND (p_trade IS NULL OR p_trade = '' OR q.trade_slug = p_trade)
   ORDER BY q.published_at DESC NULLS LAST, q.created_at DESC
   LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION public.public_questions(text, int) TO anon, authenticated;