-- Homeowners' jobs (name, email, postcode, description) were readable by every
-- signed-in published firm in the same trade, in any area. No app screen uses
-- this: firms only receive a homeowner's details when the homeowner chooses to
-- send them an enquiry (pro_leads). Close the direct read so the job stays
-- private to its owner and admins.
DROP POLICY IF EXISTS "jobs trade read" ON public.jobs;
