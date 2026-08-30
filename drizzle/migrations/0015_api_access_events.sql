CREATE TABLE IF NOT EXISTS public.api_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  bucket text NOT NULL,
  method text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('rate_limited', 'method_not_allowed', 'unauthorized', 'bad_request')),
  status integer NOT NULL,
  ip_hash text,
  user_agent text,
  detail text
);

CREATE INDEX IF NOT EXISTS api_access_events_created_idx
  ON public.api_access_events (created_at DESC);
CREATE INDEX IF NOT EXISTS api_access_events_endpoint_idx
  ON public.api_access_events (endpoint, created_at DESC);

REVOKE ALL ON public.api_access_events FROM anon, authenticated;
GRANT SELECT ON public.api_access_events TO authenticated;
GRANT ALL ON public.api_access_events TO service_role;

ALTER TABLE public.api_access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read access events" ON public.api_access_events;
CREATE POLICY "Admins read access events"
  ON public.api_access_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.prune_api_access_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_access_events WHERE created_at < now() - interval '30 days';
$$;

REVOKE ALL ON FUNCTION public.prune_api_access_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_api_access_events() TO service_role;