-- Release B of the product plan: structured, comparable quotes.
--
-- A homeowner invites up to three firms to quote for a job. Each firm sends
-- one quote with the same headings, the homeowner compares them and accepts
-- one, and the outcome is recorded.
--
--   quotes        one row per job and firm. It starts as an invitation
--                 (status 'invited') and becomes the firm's quote.
--   quote_items   optional line items under labour or materials.
--   job_outcomes  what happened to the job: which firm was chosen, and later
--                 whether the work was completed.
--
-- Money is stored in pence. VAT and totals are calculated by the server.
--
-- Access: every read and write goes through server functions that check who
-- is asking (the firm's own account, or the homeowner's private job link).
-- Row level security is on with no policies, and the browser roles hold no
-- privileges, so these tables cannot be read or written directly.

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  pro_id text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired')),
  labour_pence integer NOT NULL DEFAULT 0 CHECK (labour_pence >= 0),
  materials_pence integer NOT NULL DEFAULT 0 CHECK (materials_pence >= 0),
  vat_registered boolean NOT NULL DEFAULT false,
  vat_pence integer NOT NULL DEFAULT 0 CHECK (vat_pence >= 0),
  total_pence integer NOT NULL DEFAULT 0 CHECK (total_pence >= 0),
  start_date date,
  duration_days integer CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 730),
  warranty text NOT NULL DEFAULT '' CHECK (length(warranty) <= 500),
  payment_schedule text NOT NULL DEFAULT '' CHECK (length(payment_schedule) <= 800),
  exclusions text NOT NULL DEFAULT '' CHECK (length(exclusions) <= 1200),
  possible_extras text NOT NULL DEFAULT '' CHECK (length(possible_extras) <= 1200),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1200),
  expires_on date,
  invited_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, pro_id)
);
CREATE INDEX IF NOT EXISTS quotes_pro_id_idx ON public.quotes (pro_id, status);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('labour', 'materials')),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 200),
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id);

CREATE TABLE IF NOT EXISTS public.job_outcomes (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  pro_id text REFERENCES public.pros(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'hired'
    CHECK (outcome IN ('hired', 'completed', 'cancelled', 'problem')),
  hired_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_outcomes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quotes, public.quote_items, public.job_outcomes FROM anon, authenticated;
GRANT ALL ON public.quotes, public.quote_items, public.job_outcomes TO service_role;

-- Checks never depend on a plan. The Starter plan listed "Verified profile"
-- as a feature, which read as if they did.
UPDATE public.plans
   SET features = array_replace(features, 'Verified profile', 'Your own profile page'),
       updated_at = now()
 WHERE 'Verified profile' = ANY(features);
