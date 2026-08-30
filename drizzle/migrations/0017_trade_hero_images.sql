CREATE TABLE IF NOT EXISTS public.trade_hero_images (
  slug text PRIMARY KEY REFERENCES public.trades(slug) ON DELETE CASCADE,
  image_url text,
  alt_text text,
  focal text NOT NULL DEFAULT '50% 45%',
  focal_mobile text NOT NULL DEFAULT '60% 45%',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.trade_hero_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_hero_images TO authenticated;
GRANT ALL ON public.trade_hero_images TO service_role;

ALTER TABLE public.trade_hero_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hero image settings are public" ON public.trade_hero_images;
CREATE POLICY "Hero image settings are public"
  ON public.trade_hero_images FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage hero images" ON public.trade_hero_images;
CREATE POLICY "Admins manage hero images"
  ON public.trade_hero_images FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));