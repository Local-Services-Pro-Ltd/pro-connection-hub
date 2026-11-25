-- Visits: let a homeowner suggest a time outside the listed slots, and let the
-- firm accept or decline any visit request.
--
--   suggested_by_customer  the homeowner proposed this time; it was not one of
--                          the firm's listed slots, so it is only a request
--   decided_at / firm_note when the firm accepted or declined, and its message
--
-- Status values stay as they were: 'requested', then 'confirmed' when the firm
-- accepts, or 'cancelled' when it declines (which also frees the slot).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS suggested_by_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS firm_note text CHECK (firm_note IS NULL OR length(firm_note) <= 600);
