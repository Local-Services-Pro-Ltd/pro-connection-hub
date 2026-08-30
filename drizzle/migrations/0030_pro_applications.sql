CREATE TABLE public.pro_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  trade_slug text REFERENCES public.trades(slug),
  postcode text NOT NULL,
  years integer NOT NULL DEFAULT 0,
  website text,
  companies_house text,
  insurance_provider text,
  insurance_expiry date,
  accreditations text,
  about text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pro_applications_status_idx ON public.pro_applications (status, created_at DESC);

GRANT SELECT, UPDATE ON public.pro_applications TO authenticated;
GRANT ALL ON public.pro_applications TO service_role;

ALTER TABLE public.pro_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pro_applications admin read"
  ON public.pro_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pro_applications admin update"
  ON public.pro_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.submit_pro_application(
  p_company text,
  p_contact_name text,
  p_email text,
  p_postcode text,
  p_trade_slug text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_years integer DEFAULT 0,
  p_website text DEFAULT NULL,
  p_companies_house text DEFAULT NULL,
  p_insurance_provider text DEFAULT NULL,
  p_insurance_expiry date DEFAULT NULL,
  p_accreditations text DEFAULT NULL,
  p_about text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF coalesce(trim(p_company), '') = '' THEN RAISE EXCEPTION 'invalid_company'; END IF;
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF length(coalesce(trim(p_postcode), '')) < 2 THEN RAISE EXCEPTION 'invalid_postcode'; END IF;

  INSERT INTO public.pro_applications (
    company, contact_name, email, phone, trade_slug, postcode, years, website,
    companies_house, insurance_provider, insurance_expiry, accreditations, about
  ) VALUES (
    left(trim(p_company), 120), left(trim(p_contact_name), 120), lower(trim(p_email)),
    left(coalesce(p_phone, ''), 40), p_trade_slug, upper(trim(p_postcode)),
    greatest(coalesce(p_years, 0), 0), left(coalesce(p_website, ''), 200),
    left(coalesce(p_companies_house, ''), 40), left(coalesce(p_insurance_provider, ''), 120),
    p_insurance_expiry, left(coalesce(p_accreditations, ''), 500), left(coalesce(p_about, ''), 2000)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pro_application(text, text, text, text, text, text, integer, text, text, text, date, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pro_application(text, text, text, text, text, text, integer, text, text, text, date, text, text) TO service_role;