ALTER TABLE public.pro_applications
  ADD COLUMN claim_pro_id text REFERENCES public.pros(id) ON DELETE CASCADE,
  ADD COLUMN claimant_user_id uuid,
  ADD COLUMN kind text NOT NULL DEFAULT 'application';

ALTER TABLE public.pro_applications
  ADD CONSTRAINT pro_applications_kind_check CHECK (kind IN ('application', 'claim'));

CREATE UNIQUE INDEX pro_applications_one_open_claim_per_user
  ON public.pro_applications (claim_pro_id, claimant_user_id)
  WHERE kind = 'claim' AND status NOT IN ('approved', 'rejected');

CREATE INDEX pro_applications_claim_listing_idx
  ON public.pro_applications (claim_pro_id, status)
  WHERE kind = 'claim';

CREATE OR REPLACE FUNCTION public.submit_listing_claim(
  p_pro_id text,
  p_contact_name text,
  p_role text,
  p_email text,
  p_phone text,
  p_consent boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_listing public.pros%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_consent IS NOT TRUE THEN RAISE EXCEPTION 'consent_required'; END IF;
  IF length(trim(coalesce(p_contact_name, ''))) < 2 THEN RAISE EXCEPTION 'invalid_contact_name'; END IF;
  IF p_role NOT IN ('Owner', 'Director', 'Partner', 'Employee') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF length(trim(coalesce(p_phone, ''))) < 7 THEN RAISE EXCEPTION 'invalid_phone'; END IF;

  SELECT * INTO v_listing FROM public.pros
    WHERE id = p_pro_id AND published = true AND user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_unavailable'; END IF;

  INSERT INTO public.pro_applications (
    company, contact_name, email, phone, trade_slug, postcode,
    about, status, kind, claim_pro_id, claimant_user_id, applicant_message
  ) VALUES (
    v_listing.company, left(trim(p_contact_name), 120), lower(trim(p_email)),
    left(trim(p_phone), 40), v_listing.trade_slug, v_listing.postcode,
    'Claim of an existing listing; ID and insurance checks remain required before quoting.',
    'pending', 'claim', v_listing.id, v_user_id, 'Role at business: ' || p_role
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_listing_claim(text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_listing_claim(text, text, text, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_listing_claim_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.kind = 'claim' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'admin_approval_required';
    END IF;
    IF NEW.claim_pro_id IS NULL OR NEW.claimant_user_id IS NULL THEN
      RAISE EXCEPTION 'invalid_claim';
    END IF;
    SELECT user_id INTO v_owner FROM public.pros WHERE id = NEW.claim_pro_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'listing_unavailable'; END IF;
    IF v_owner IS NOT NULL AND v_owner <> NEW.claimant_user_id THEN
      RAISE EXCEPTION 'listing_already_claimed';
    END IF;
    UPDATE public.pros SET user_id = NEW.claimant_user_id WHERE id = NEW.claim_pro_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_listing_claim_review_trg
  BEFORE UPDATE OF status ON public.pro_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_claim_review();

CREATE OR REPLACE FUNCTION public.guard_pro_owner_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    AND coalesce(auth.role(), '') <> 'service_role'
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_approval_required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_pro_owner_claim_trg
  BEFORE UPDATE OF user_id ON public.pros
  FOR EACH ROW EXECUTE FUNCTION public.guard_pro_owner_claim();