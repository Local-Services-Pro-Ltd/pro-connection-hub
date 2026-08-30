DROP POLICY IF EXISTS "Pro project images are readable" ON storage.objects;
CREATE POLICY "Pro project images are readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pro-projects');

DROP POLICY IF EXISTS "Admins upload pro project images" ON storage.objects;
CREATE POLICY "Admins upload pro project images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pro-projects' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update pro project images" ON storage.objects;
CREATE POLICY "Admins update pro project images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pro-projects' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'pro-projects' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete pro project images" ON storage.objects;
CREATE POLICY "Admins delete pro project images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pro-projects' AND public.has_role(auth.uid(), 'admin'));