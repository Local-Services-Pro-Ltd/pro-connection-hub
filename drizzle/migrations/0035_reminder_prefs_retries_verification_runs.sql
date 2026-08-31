-- 1. Firm-level reminder email preferences.
ALTER TABLE public.pro_applications
  ADD COLUMN IF NOT EXISTS reminder_prefs jsonb NOT NULL
  DEFAULT '{"documents_pending":true,"document_rejected":true,"insurance_expiring":true,"insurance_expired":true}'::jsonb;

-- 2. Reminder delivery retry / dead-letter state.
ALTER TABLE public.application_reminders
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_at timestamptz;

-- Existing rows predate retry tracking and were sent inline.
UPDATE public.application_reminders
   SET delivery_status = 'delivered', delivered_at = coalesce(delivered_at, created_at)
 WHERE delivery_status = 'pending' AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS application_reminders_queue_idx
  ON public.application_reminders (delivery_status, next_attempt_at);

-- 3. Verification run log (manual re-runs and scheduled runs).
CREATE TABLE IF NOT EXISTS public.application_verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pro_applications(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  outcome text NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  duration_ms integer,
  triggered_by uuid REFERENCES auth.users(id),
  triggered_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_verification_runs_app_idx
  ON public.application_verification_runs (application_id, created_at DESC);

GRANT SELECT ON public.application_verification_runs TO authenticated;
GRANT ALL ON public.application_verification_runs TO service_role;

ALTER TABLE public.application_verification_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification runs admin read" ON public.application_verification_runs;
CREATE POLICY "verification runs admin read"
  ON public.application_verification_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Status payload now carries the firm's reminder preferences.
CREATE OR REPLACE FUNCTION public.pro_application_status(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'reminder_prefs', v_row.reminder_prefs,
    'documents', v_docs,
    'timeline', v_timeline
  );
END;
$function$;

-- 5. Token-gated preference update for the firm.
CREATE OR REPLACE FUNCTION public.pro_application_set_reminder_prefs(
  p_token text,
  p_prefs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_prefs jsonb;
BEGIN
  IF coalesce(trim(p_token), '') = '' THEN RETURN NULL; END IF;

  SELECT id INTO v_id FROM public.pro_applications WHERE tracking_token = trim(p_token);
  IF v_id IS NULL THEN RETURN NULL; END IF;

  v_prefs := jsonb_build_object(
    'documents_pending', coalesce((p_prefs->>'documents_pending')::boolean, true),
    'document_rejected', coalesce((p_prefs->>'document_rejected')::boolean, true),
    'insurance_expiring', coalesce((p_prefs->>'insurance_expiring')::boolean, true),
    'insurance_expired', coalesce((p_prefs->>'insurance_expired')::boolean, true)
  );

  UPDATE public.pro_applications
     SET reminder_prefs = v_prefs, updated_at = now()
   WHERE id = v_id;

  RETURN v_prefs;
END;
$function$;

REVOKE ALL ON FUNCTION public.pro_application_set_reminder_prefs(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pro_application_set_reminder_prefs(text, jsonb) TO service_role;