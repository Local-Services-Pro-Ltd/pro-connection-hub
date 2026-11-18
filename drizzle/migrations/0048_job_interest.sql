-- Firms covering a job's area can register interest in a posted job. The
-- homeowner then chooses who to contact; firms never receive the homeowner's
-- name or email from this table. Server-only: all reads and writes go through
-- server functions using the service role, which check the firm is published,
-- in the job's trade and in a live area covering the job's postcode.
CREATE TABLE IF NOT EXISTS public.job_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  message text CHECK (message IS NULL OR char_length(message) <= 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, pro_id)
);
CREATE INDEX IF NOT EXISTS job_interest_job_idx ON public.job_interest(job_id);
CREATE INDEX IF NOT EXISTS job_interest_pro_idx ON public.job_interest(pro_id);

ALTER TABLE public.job_interest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_interest FROM public, anon, authenticated;
GRANT ALL ON public.job_interest TO service_role;

-- The homeowner who owns the job (signed in) may see who is interested.
GRANT SELECT ON public.job_interest TO authenticated;
CREATE POLICY "job_interest owner read" ON public.job_interest FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'::app_role));
