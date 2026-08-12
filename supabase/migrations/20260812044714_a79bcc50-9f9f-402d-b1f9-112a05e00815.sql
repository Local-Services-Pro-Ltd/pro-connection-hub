CREATE TABLE public.plans (
  slug text PRIMARY KEY,
  name text NOT NULL,
  price text NOT NULL,
  per text NOT NULL DEFAULT '/month',
  line text NOT NULL DEFAULT '',
  features text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans public read" ON public.plans FOR SELECT TO anon, authenticated USING (visible = true);

CREATE TRIGGER plans_touch_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.plans (slug, name, price, per, line, features, featured, visible, sort_order) VALUES
('starter', 'Starter', '£29', '/month', 'Sole traders getting going.', ARRAY['Up to 8 matched jobs','1 trade category','3 postcode areas','Verified profile'], false, true, 1),
('trade', 'Trade', '£79', '/month', 'Established firms with a van or two.', ARRAY['Unlimited matched jobs','3 trade categories','10 postcode areas','Priority ranking','Photo portfolio'], true, true, 2),
('contractor', 'Contractor', '£129', '/month', 'Multi-team outfits and larger works.', ARRAY['Everything in Trade','Unlimited categories & areas','Team profiles','Account manager'], false, false, 3);

ALTER TABLE public.areas ADD COLUMN status text NOT NULL DEFAULT 'coming_soon';
ALTER TABLE public.areas ADD CONSTRAINT areas_status_check CHECK (status IN ('live','coming_soon'));
UPDATE public.areas SET status = 'live' WHERE slug = 'london';