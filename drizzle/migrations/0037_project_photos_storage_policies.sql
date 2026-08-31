-- Homeowners upload job photos into a folder named after their user id.
CREATE POLICY "Owners upload their project photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners read their project photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners delete their project photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read every project photo"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-photos' AND public.has_role(auth.uid(), 'admin'));
