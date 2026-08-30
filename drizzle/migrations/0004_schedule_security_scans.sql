-- Shared secret the scheduler uses to authenticate to /api/public/security-scan.
-- It never leaves the database: no client role has any privilege on this table.
CREATE TABLE IF NOT EXISTS public.security_scan_secret (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_scan_secret ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_scan_secret FROM anon, authenticated;
INSERT INTO public.security_scan_secret (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.security_scan_token_matches(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(length(p_token) > 20
                  AND EXISTS (SELECT 1 FROM public.security_scan_secret s
                              WHERE s.token = p_token), false);
$$;
REVOKE ALL ON FUNCTION public.security_scan_token_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_scan_token_matches(text) TO service_role;

-- Daily scheduled scan (03:17 UTC) against the stable published URL.
SELECT cron.unschedule('security-regression-daily')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'security-regression-daily');

SELECT cron.schedule(
  'security-regression-daily',
  '17 3 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://project--41f705f4-e39f-4523-9e1f-3a95ab43d3d7.lovable.app/api/public/security-scan?source=scheduled',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-security-scan-token', (SELECT token FROM public.security_scan_secret LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $job$
);