
GRANT INSERT ON public.jobs TO anon;
CREATE POLICY "jobs guest insert" ON public.jobs FOR INSERT TO anon WITH CHECK (user_id IS NULL);
