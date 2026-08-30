-- 1. Pipeline columns for change requests, verification and SLA tracking
ALTER TABLE public.pro_applications
  ADD COLUMN IF NOT EXISTS requested_fields text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS applicant_message text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_note text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

UPDATE public.pro_applications
SET due_at = created_at + interval '5 days'
WHERE due_at IS NULL;

-- 2. Per-document tracking
CREATE TABLE IF NOT EXISTS public.pro_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pro_applications(id) ON DELETE CASCADE,
  kind text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pro_application_documents_app_idx
  ON public.pro_application_documents (application_id, created_at DESC);

GRANT SELECT, UPDATE ON public.pro_application_documents TO authenticated;
GRANT ALL ON public.pro_application_documents TO service_role;

ALTER TABLE public.pro_application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "application documents admin read" ON public.pro_application_documents;
CREATE POLICY "application documents admin read"
  ON public.pro_application_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "application documents admin update" ON public.pro_application_documents;
CREATE POLICY "application documents admin update"
  ON public.pro_application_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Applicant paperwork lives in the private application-docs bucket; only
-- admins may read it directly, everything else goes through service_role.
DROP POLICY IF EXISTS "application docs admin read" ON storage.objects;
CREATE POLICY "application docs admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'application-docs' AND public.has_role(auth.uid(), 'admin'));

-- 3. Defaults: SLA due date on insert
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
  IF NEW.due_at IS NULL THEN
    NEW.due_at := coalesce(NEW.created_at, now()) + interval '5 days';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.tracking_token := OLD.tracking_token;
    NEW.reference := OLD.reference;
    IF NEW.first_reviewed_at IS NULL
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'pending' THEN
      NEW.first_reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Token-gated applicant status, documents and resubmission
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
  v_docs jsonb;
BEGIN
  IF coalesce(trim(p_token), '') = '' THEN RETURN NULL; END IF;

  SELECT * INTO v_row FROM public.pro_applications WHERE tracking_token = trim(p_token);
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'action', a.action,
    'from_status', a.from_status,
    'to_status', a.to_status,
    'reviewer_note', a.reviewer_note,
    'created_at', a.created_at
  ) ORDER BY a.created_at), '[]'::jsonb)
  INTO v_timeline
  FROM public.pro_application_audit a
  WHERE a.application_id = v_row.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'kind', d.kind,
    'file_name', d.file_name,
    'size_bytes', d.size_bytes,
    'status', d.status,
    'reviewer_note', d.reviewer_note,
    'created_at', d.created_at
  ) ORDER BY d.created_at), '[]'::jsonb)
  INTO v_docs
  FROM public.pro_application_documents d
  WHERE d.application_id = v_row.id;

  RETURN jsonb_build_object(
    'reference', v_row.reference,
    'company', v_row.company,
    'trade_slug', v_row.trade_slug,
    'postcode', v_row.postcode,
    'status', v_row.status,
    'reviewer_note', v_row.reviewer_note,
    'requested_fields', to_jsonb(v_row.requested_fields),
    'submitted_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'reviewed_at', v_row.reviewed_at,
    'due_at', v_row.due_at,
    'verification', v_row.verification,
    'verified_at', v_row.verified_at,
    'documents', v_docs,
    'timeline', v_timeline
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pro_application_status(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pro_application_status(text) TO service_role;

CREATE OR REPLACE FUNCTION public.pro_application_id_for_token(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.pro_applications WHERE tracking_token = trim(p_token);
$$;

REVOKE ALL ON FUNCTION public.pro_application_id_for_token(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pro_application_id_for_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.pro_application_resubmit(
  p_token text,
  p_updates jsonb,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pro_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.pro_applications WHERE tracking_token = trim(coalesce(p_token, ''));
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.status NOT IN ('changes_requested', 'pending', 'resubmitted') THEN
    RAISE EXCEPTION 'not_editable';
  END IF;

  UPDATE public.pro_applications SET
    contact_name = coalesce(nullif(trim(p_updates->>'contact_name'), ''), contact_name),
    phone = coalesce(nullif(trim(p_updates->>'phone'), ''), phone),
    website = coalesce(nullif(trim(p_updates->>'website'), ''), website),
    companies_house = coalesce(nullif(trim(p_updates->>'companies_house'), ''), companies_house),
    insurance_provider = coalesce(nullif(trim(p_updates->>'insurance_provider'), ''), insurance_provider),
    insurance_expiry = coalesce(nullif(trim(p_updates->>'insurance_expiry'), '')::date, insurance_expiry),
    accreditations = coalesce(nullif(trim(p_updates->>'accreditations'), ''), accreditations),
    about = coalesce(nullif(trim(p_updates->>'about'), ''), about),
    applicant_message = nullif(trim(coalesce(p_message, '')), ''),
    status = 'resubmitted',
    resubmitted_at = now(),
    requested_fields = '{}'
  WHERE id = v_row.id;

  INSERT INTO public.pro_application_audit (
    application_id, reference, company, action, from_status, to_status, reviewer_note
  ) VALUES (
    v_row.id, v_row.reference, v_row.company, 'resubmitted', v_row.status, 'resubmitted',
    nullif(trim(coalesce(p_message, '')), '')
  );

  RETURN jsonb_build_object('ok', true, 'reference', v_row.reference);
END;
$$;

REVOKE ALL ON FUNCTION public.pro_application_resubmit(text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pro_application_resubmit(text, jsonb, text) TO service_role;

-- 5. SLA + performance summary (admin only)
CREATE OR REPLACE FUNCTION public.pro_application_sla()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admins_only';
  END IF;

  SELECT jsonb_build_object(
    'open_total', count(*) FILTER (WHERE status IN ('pending','in_review','changes_requested','resubmitted')),
    'overdue', count(*) FILTER (WHERE status IN ('pending','in_review','changes_requested','resubmitted') AND due_at < now()),
    'due_soon', count(*) FILTER (WHERE status IN ('pending','in_review','changes_requested','resubmitted') AND due_at >= now() AND due_at < now() + interval '24 hours'),
    'escalated', count(*) FILTER (WHERE escalated_at IS NOT NULL AND status IN ('pending','in_review','changes_requested','resubmitted')),
    'awaiting_firm', count(*) FILTER (WHERE status = 'changes_requested'),
    'approved_30d', count(*) FILTER (WHERE status = 'approved' AND reviewed_at > now() - interval '30 days'),
    'rejected_30d', count(*) FILTER (WHERE status = 'rejected' AND reviewed_at > now() - interval '30 days'),
    'avg_first_response_hours', round(avg(EXTRACT(epoch FROM (first_reviewed_at - created_at)) / 3600.0) FILTER (WHERE first_reviewed_at IS NOT NULL)::numeric, 1),
    'avg_decision_hours', round(avg(EXTRACT(epoch FROM (reviewed_at - created_at)) / 3600.0) FILTER (WHERE status IN ('approved','rejected') AND reviewed_at IS NOT NULL)::numeric, 1),
    'insurance_expired', count(*) FILTER (WHERE insurance_expiry IS NOT NULL AND insurance_expiry < current_date),
    'insurance_expiring_60d', count(*) FILTER (WHERE insurance_expiry IS NOT NULL AND insurance_expiry >= current_date AND insurance_expiry < current_date + 60)
  )
  INTO v_result
  FROM public.pro_applications;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.pro_application_sla() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pro_application_sla() TO authenticated, service_role;