-- Reviews submitted by customers must be moderated before they appear publicly.
DROP POLICY IF EXISTS "reviews own insert" ON public.reviews;
CREATE POLICY "reviews own insert"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id AND status = 'pending'::review_status);

-- Customers may only edit their own reviews while they are still pending moderation.
DROP POLICY IF EXISTS "reviews own update" ON public.reviews;
CREATE POLICY "reviews own update"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id AND status = 'pending'::review_status)
  WITH CHECK (auth.uid() = author_id AND status = 'pending'::review_status);