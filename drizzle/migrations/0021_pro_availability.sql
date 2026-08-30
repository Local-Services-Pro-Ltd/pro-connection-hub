CREATE TABLE public.pro_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440),
  end_minute integer NOT NULL CHECK (end_minute > 0 AND end_minute <= 1440),
  slot_minutes integer NOT NULL DEFAULT 120 CHECK (slot_minutes BETWEEN 30 AND 480),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pro_id, weekday, start_minute)
);

GRANT SELECT ON public.pro_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_availability TO authenticated;
GRANT ALL ON public.pro_availability TO service_role;

ALTER TABLE public.pro_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability public read"
  ON public.pro_availability FOR SELECT
  TO anon, authenticated
  USING (active AND EXISTS (
    SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.published
  ));

CREATE POLICY "availability owner manage"
  ON public.pro_availability FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.user_id = auth.uid()));

CREATE POLICY "availability admin manage"
  ON public.pro_availability FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX pro_availability_pro_idx ON public.pro_availability (pro_id, weekday);