
-- profiles
CREATE TYPE public.account_type AS ENUM ('customer','tradesman');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  account_type public.account_type NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'account_type')::public.account_type, 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- trades
CREATE TABLE public.trades (
  slug text PRIMARY KEY,
  name text NOT NULL,
  blurb text NOT NULL,
  typical_cost text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.trades TO anon, authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades public read" ON public.trades FOR SELECT TO anon, authenticated USING (true);

-- areas
CREATE TABLE public.areas (
  slug text PRIMARY KEY,
  name text NOT NULL,
  note text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.areas TO anon, authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas public read" ON public.areas FOR SELECT TO anon, authenticated USING (true);

-- pros
CREATE TYPE public.availability AS ENUM ('immediate','within_week','within_month','booked');

CREATE TABLE public.pros (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  company text NOT NULL,
  trade_slug text NOT NULL REFERENCES public.trades(slug) ON DELETE RESTRICT,
  area text NOT NULL,
  area_slug text,
  postcode text,
  bio text NOT NULL DEFAULT '',
  years int NOT NULL DEFAULT 0,
  response_mins int NOT NULL DEFAULT 60,
  day_rate int,
  min_job_budget int NOT NULL DEFAULT 0,
  availability public.availability NOT NULL DEFAULT 'within_week',
  services text[] NOT NULL DEFAULT '{}',
  photo int NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT true,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  review_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pros_trade_idx ON public.pros(trade_slug);
GRANT SELECT ON public.pros TO anon;
GRANT SELECT, INSERT, UPDATE ON public.pros TO authenticated;
GRANT ALL ON public.pros TO service_role;
ALTER TABLE public.pros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pros public read" ON public.pros FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "pros owner read" ON public.pros FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pros owner insert" ON public.pros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pros owner update" ON public.pros FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER pros_touch BEFORE UPDATE ON public.pros FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- credentials
CREATE TABLE public.pro_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  reference text,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_credentials_pro_idx ON public.pro_credentials(pro_id);
GRANT SELECT ON public.pro_credentials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_credentials TO authenticated;
GRANT ALL ON public.pro_credentials TO service_role;
ALTER TABLE public.pro_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials public read" ON public.pro_credentials FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.published = true));
CREATE POLICY "credentials owner all" ON public.pro_credentials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.user_id = auth.uid()));

-- reviews
CREATE TYPE public.review_status AS ENUM ('published','pending','rejected');

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_place text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  job_type text,
  status public.review_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_pro_idx ON public.reviews(pro_id);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "reviews own read" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "reviews own insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND status = 'published');
CREATE POLICY "reviews own update" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "reviews own delete" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.refresh_pro_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target text;
BEGIN
  target := COALESCE(NEW.pro_id, OLD.pro_id);
  UPDATE public.pros p SET
    rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric,1) FROM public.reviews r WHERE r.pro_id = target AND r.status='published'),0),
    review_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.pro_id = target AND r.status='published')
  WHERE p.id = target;
  RETURN NULL;
END; $$;
CREATE TRIGGER reviews_refresh_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_pro_rating();

-- jobs
CREATE TYPE public.job_status AS ENUM ('open','matched','closed');

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trade_slug text NOT NULL REFERENCES public.trades(slug) ON DELETE RESTRICT,
  postcode text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  timing text NOT NULL DEFAULT 'As soon as possible',
  budget_band text NOT NULL DEFAULT 'Not sure yet',
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'open',
  reference text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_user_idx ON public.jobs(user_id);
GRANT SELECT, INSERT ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs own read" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "jobs own insert" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs trade read" ON public.jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pros p WHERE p.user_id = auth.uid() AND p.trade_slug = jobs.trade_slug));
