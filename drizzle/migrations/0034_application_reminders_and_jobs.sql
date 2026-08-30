-- Reminder ledger: one row per reminder actually sent, used for idempotency.
CREATE TABLE IF NOT EXISTS public.application_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pro_applications(id) ON DELETE CASCADE,
  kind text NOT NULL,
  dedupe_key text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS application_reminders_unique_idx
  ON public.application_reminders (application_id, kind, dedupe_key);
CREATE INDEX IF NOT EXISTS application_reminders_created_idx
  ON public.application_reminders (created_at DESC);

GRANT SELECT ON public.application_reminders TO authenticated;
GRANT ALL ON public.application_reminders TO service_role;

ALTER TABLE public.application_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "application_reminders admin read" ON public.application_reminders;
CREATE POLICY "application_reminders admin read"
  ON public.application_reminders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Background job state: single-flight lease, pause switch, last result.
CREATE TABLE IF NOT EXISTS public.background_jobs (
  name text PRIMARY KEY,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  paused_reason text,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.background_jobs TO authenticated;
GRANT ALL ON public.background_jobs TO service_role;

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "background_jobs admin read" ON public.background_jobs;
CREATE POLICY "background_jobs admin read"
  ON public.background_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.background_jobs (name) VALUES ('application-maintenance')
  ON CONFLICT (name) DO NOTHING;

-- Atomic lease acquisition. Returns false when another run holds the lease
-- or the job is paused.
CREATE OR REPLACE FUNCTION public.acquire_job_lease(p_name text, p_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  INSERT INTO public.background_jobs (name) VALUES (p_name)
    ON CONFLICT (name) DO NOTHING;

  UPDATE public.background_jobs
     SET locked_until = now() + make_interval(secs => greatest(30, least(p_seconds, 3600))),
         last_run_at = now(),
         updated_at = now()
   WHERE name = p_name
     AND (locked_until IS NULL OR locked_until < now())
  RETURNING true INTO v_ok;

  RETURN coalesce(v_ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_job_lease(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_job_lease(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_job_lease(
  p_name text,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.background_jobs
     SET locked_until = NULL,
         last_result = coalesce(p_result, '{}'::jsonb),
         last_error = p_error,
         updated_at = now()
   WHERE name = p_name;
$$;

REVOKE ALL ON FUNCTION public.release_job_lease(text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_job_lease(text, jsonb, text) TO service_role;

-- Daily maintenance run (07:20 UTC): re-verification plus applicant reminders.
SELECT cron.unschedule('application-maintenance-daily')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'application-maintenance-daily');

SELECT cron.schedule(
  'application-maintenance-daily',
  '20 7 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://project--41f705f4-e39f-4523-9e1f-3a95ab43d3d7.lovable.app/api/public/application-maintenance?source=scheduled',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-security-scan-token', (SELECT token FROM public.security_scan_secret LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $job$
);
