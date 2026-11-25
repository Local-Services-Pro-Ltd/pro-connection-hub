-- Phase 2, step 1: firms send their own insurance and registration details
-- from the dashboard, with a copy of the document, for an admin to check.
--
--   document_path          where the uploaded certificate is stored
--   submitted_at           when the firm last sent or changed the details
--   review_note            what the admin told the firm if it needs attention
--   expiry_reminder_stage  0 none, 1 thirty-day reminder sent, 2 seven-day
--                          reminder sent, 3 expiry notice sent
--
-- These four columns are not granted to the public role, so they never appear
-- on a profile.
ALTER TABLE public.pro_credentials
  ADD COLUMN IF NOT EXISTS document_path text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text CHECK (review_note IS NULL OR length(review_note) <= 600),
  ADD COLUMN IF NOT EXISTS expiry_reminder_stage smallint NOT NULL DEFAULT 0;

-- A firm could already edit its own credentials, and the old rule only kept
-- the "verified" flag as it was. That let a firm change the expiry date or the
-- reference of something we had already checked and stay verified. Now any
-- change by the firm to what we checked sends it back for checking, and a new
-- expiry date restarts the reminders.
CREATE OR REPLACE FUNCTION public.enforce_credential_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_forced boolean := coalesce(current_setting('app.force_nonadmin', true), '') = 'on';
  v_trusted boolean;
BEGIN
  v_trusted := (NOT v_forced AND current_user IN ('postgres', 'supabase_admin', 'service_role'))
               OR public.has_role(auth.uid(), 'admin'::app_role);

  IF TG_OP = 'UPDATE' AND NEW.expires_on IS DISTINCT FROM OLD.expires_on THEN
    NEW.expiry_reminder_stage := 0;
  END IF;

  IF v_trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verified := false;
    NEW.verified_at := NULL;
    NEW.review_note := NULL;
    NEW.expiry_reminder_stage := 0;
    RETURN NEW;
  END IF;

  NEW.pro_id := OLD.pro_id;
  NEW.review_note := OLD.review_note;
  IF NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.label IS DISTINCT FROM OLD.label
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.expires_on IS DISTINCT FROM OLD.expires_on
     OR NEW.document_path IS DISTINCT FROM OLD.document_path THEN
    NEW.verified := false;
    NEW.verified_at := NULL;
  ELSE
    NEW.verified := OLD.verified;
    NEW.verified_at := OLD.verified_at;
  END IF;
  RETURN NEW;
END;
$function$;

-- Private storage for the certificates. A firm can add files to its own
-- folder only; nobody can read them from a browser. The server makes a
-- short-lived link for an admin, or for the firm that uploaded the file.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pro-credentials', 'pro-credentials', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Owners upload own credential documents" ON storage.objects;
CREATE POLICY "Owners upload own credential documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pro-credentials' AND public.owns_pro(split_part(name, '/', 1)));

-- What the public may read about a credential.
--
-- Two faults found while building this:
--   1. Signed-out visitors could not load a profile's checks at all, because
--      the page asked for every column and they are only allowed some.
--   2. Any signed-in user could read every column, including insurance policy
--      numbers.
-- Both roles now read the same public columns. A register number (Companies
-- House, Gas Safe, NICEIC, NAPIT, FENSA) is public so anyone can look the firm
-- up; an insurance policy number is not.
ALTER TABLE public.pro_credentials
  ADD COLUMN IF NOT EXISTS public_reference text
  GENERATED ALWAYS AS (
    CASE WHEN kind IN ('companies_house', 'gas_safe', 'niceic', 'napit', 'fensa')
         THEN reference END
  ) STORED;

REVOKE SELECT ON public.pro_credentials FROM anon, authenticated;
GRANT SELECT (id, pro_id, label, kind, verified, verified_at, expires_on, created_at, public_reference)
  ON public.pro_credentials TO anon, authenticated;
