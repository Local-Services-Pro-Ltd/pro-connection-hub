-- Roll back the row-level public read on bookings: it exposed customer rows.
DROP POLICY IF EXISTS "bookings slot visibility" ON public.bookings;
REVOKE ALL ON public.bookings FROM anon;
REVOKE ALL ON public.bookings FROM authenticated;
GRANT SELECT, INSERT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

DROP VIEW IF EXISTS public.pro_booked_slots;

-- Slot availability is exposed through a narrow function that returns times
-- only, so no customer detail can ever leave the table.
CREATE OR REPLACE FUNCTION public.pro_booked_slots(p_pro_id text)
RETURNS TABLE(slot_start timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.slot_start
    FROM public.bookings b
    JOIN public.pros p ON p.id = b.pro_id AND p.published
   WHERE b.pro_id = p_pro_id AND b.status <> 'cancelled';
$function$;

GRANT EXECUTE ON FUNCTION public.pro_booked_slots(text) TO anon, authenticated;

-- Draft portfolio images must not be downloadable from the private bucket.
DROP POLICY IF EXISTS "Pro project images are readable" ON storage.objects;
CREATE POLICY "Pro project images are readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'pro-projects'
    AND EXISTS (
      SELECT 1
        FROM public.pro_projects pp
        JOIN public.pros p ON p.id = pp.pro_id
       WHERE pp.published AND p.published
         AND (pp.before_url LIKE '%' || storage.objects.name || '%'
           OR pp.after_url LIKE '%' || storage.objects.name || '%')
    )
  );

DROP POLICY IF EXISTS "Owners read own pro project images" ON storage.objects;
CREATE POLICY "Owners read own pro project images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pro-projects'
    AND (public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.pros p
                  WHERE p.user_id = auth.uid()
                    AND storage.objects.name LIKE p.id || '/%'))
  );