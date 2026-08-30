DROP POLICY IF EXISTS "Trade hero images are readable" ON storage.objects;
CREATE POLICY "Trade hero images are readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'trade-heroes');

DROP POLICY IF EXISTS "Admins upload trade hero images" ON storage.objects;
CREATE POLICY "Admins upload trade hero images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trade-heroes' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update trade hero images" ON storage.objects;
CREATE POLICY "Admins update trade hero images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trade-heroes' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'trade-heroes' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete trade hero images" ON storage.objects;
CREATE POLICY "Admins delete trade hero images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trade-heroes' AND public.has_role(auth.uid(), 'admin'));