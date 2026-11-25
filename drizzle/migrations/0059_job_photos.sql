-- Phase 2: photos on posted jobs.
--
-- Up to four photos per job, stored as object paths ({job id}/...) in a
-- private bucket. The browser roles are not granted the new column and have
-- no storage policies on the bucket: the server issues a one-off upload link
-- straight after the job is posted, and short-lived viewing links to the
-- homeowner and to firms that can already see the job.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(photos) <= 4);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-photos', 'job-photos', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Only the server may set a job's photos. Browsers can insert and edit their
-- own jobs, so without this a browser could point a job at any stored path.
-- (The server also refuses to sign any path outside the job's own folder.)
CREATE OR REPLACE FUNCTION public.guard_job_photos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.photos := '{}';
  ELSE
    NEW.photos := OLD.photos;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_job_photos_trg ON public.jobs;
CREATE TRIGGER guard_job_photos_trg
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_photos();
