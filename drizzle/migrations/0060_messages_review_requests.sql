-- Phase 2: messages between a homeowner and the firms they invited to quote,
-- and automatic nudges after a firm is chosen.
--
--   job_messages   one row per message. A conversation is one job and one
--                  firm, and exists only where the homeowner invited that firm
--                  to quote. Row level security is on with no policies and the
--                  browser roles hold no privileges: every read and write goes
--                  through server functions that check who is asking.
--
--   job_outcomes   two timestamps so each nudge email is sent once:
--                  completion_nudged_at  "has the work finished?"
--                  review_requested_at   "please review the firm"
CREATE TABLE IF NOT EXISTS public.job_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('homeowner', 'firm')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_messages_thread_idx
  ON public.job_messages (job_id, pro_id, created_at);

ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_messages FROM anon, authenticated;
GRANT ALL ON public.job_messages TO service_role;

ALTER TABLE public.job_outcomes
  ADD COLUMN IF NOT EXISTS completion_nudged_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;
