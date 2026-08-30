-- Tracking + audit for certification applications
ALTER TABLE public.pro_applications
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS tracking_token text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.pro_applications
SET reference = COALESCE(reference, 'TFC-' || upper(substr(replace(id::text, '-', ''), 1, 8))),
    tracking_token = COALESCE(tracking_token, encode(gen_random_bytes(24), 'hex'));

ALTER TABLE public.pro_applications
  ALTER COLUMN reference SET DEFAULT NULL,
  ALTER COLUMN tracking_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS pro_applications_token_idx ON public.pro_applications (tracking_token);
CREATE UNIQUE INDEX IF NOT EXISTS pro_applications_reference_idx ON public.pro_applications (reference);

-- Reference is derived from the row id when not supplied
CREATE OR REPLACE FUNCTION public.pro_application_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'TFC-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    -- tracking token and reference are immutable once issued
    NEW.tracking_token := OLD.tracking_token;
    NEW.reference := OLD.reference;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pro_application_defaults_trg ON public.pro_applications;
CREATE TRIGGER pro_application_defaults_trg
  BEFORE INSERT OR UPDATE ON public.pro_applications
  FOR EACH ROW EXECUTE FUNCTION public.pro_application_defaults();

-- Audit log of every application change and reviewer action
CREATE TABLE IF NOT EXISTS public.pro_application_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pro_applications(id) ON DELETE CASCADE,
  reference text,
  company text NOT NULL,
  action text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reviewer_note text,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pro_application_audit_app_idx
  ON public.pro_application_audit (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pro_application_audit_created_idx
  ON public.pro_application_audit (created_at DESC);

GRANT SELECT ON public.pro_application_audit TO authenticated;
GRANT ALL ON public.pro_application_audit TO service_role;

ALTER TABLE public.pro_application_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_application_audit admin read" ON public.pro_application_audit;
CREATE POLICY "pro_application_audit admin read"
  ON public.pro_application_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_pro_application_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_action text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'submitted';
    INSERT INTO public.pro_application_audit (
      application_id, reference, company, action, from_status, to_status,
      reviewer_note, changed_by, changed_by_email
    ) VALUES (
      NEW.id, NEW.reference, NEW.company, v_action, NULL, NEW.status,
      NEW.reviewer_note, auth.uid(), v_email
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewer_note IS DISTINCT FROM OLD.reviewer_note THEN
    v_action := CASE
      WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.status
      ELSE 'note_updated'
    END;
    INSERT INTO public.pro_application_audit (
      application_id, reference, company, action, from_status, to_status,
      reviewer_note, changed_by, changed_by_email
    ) VALUES (
      NEW.id, NEW.reference, NEW.company, v_action, OLD.status, NEW.status,
      NEW.reviewer_note, auth.uid(), v_email
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_pro_application_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS log_pro_application_change_trg ON public.pro_applications;
CREATE TRIGGER log_pro_application_change_trg
  AFTER INSERT OR UPDATE ON public.pro_applications
  FOR EACH ROW EXECUTE FUNCTION public.log_pro_application_change();

-- Token-gated public status lookup (no PII beyond what the applicant supplied)
CREATE OR REPLACE FUNCTION public.pro_application_status(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pro_applications%ROWTYPE;
  v_timeline jsonb;
BEGIN
  IF coalesce(trim(p_token), '') = '' THEN RETURN NULL; END IF;

  SELECT * INTO v_row FROM public.pro_applications WHERE tracking_token = trim(p_token);
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'action', a.action,
    'from_status', a.from_status,
    'to_status', a.to_status,
    'created_at', a.created_at
  ) ORDER BY a.created_at), '[]'::jsonb)
  INTO v_timeline
  FROM public.pro_application_audit a
  WHERE a.application_id = v_row.id;

  RETURN jsonb_build_object(
    'reference', v_row.reference,
    'company', v_row.company,
    'trade_slug', v_row.trade_slug,
    'postcode', v_row.postcode,
    'status', v_row.status,
    'reviewer_note', v_row.reviewer_note,
    'submitted_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'reviewed_at', v_row.reviewed_at,
    'timeline', v_timeline
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pro_application_status(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pro_application_status(text) TO service_role;
