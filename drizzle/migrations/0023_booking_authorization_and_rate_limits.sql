-- 1. The public booked-slot projection must not run with definer rights.
ALTER VIEW public.pro_booked_slots SET (security_invoker = true, security_barrier = true);

-- Visitors need to see which slots are taken, but only the pro id and the
-- slot time — never the customer contact details on the booking row.
REVOKE ALL ON public.bookings FROM anon;
GRANT SELECT (pro_id, slot_start, status) ON public.bookings TO anon, authenticated;

DROP POLICY IF EXISTS "bookings slot visibility" ON public.bookings;
CREATE POLICY "bookings slot visibility"
  ON public.bookings FOR SELECT
  TO anon, authenticated
  USING (status <> 'cancelled' AND EXISTS (
    SELECT 1 FROM public.pros p WHERE p.id = pro_id AND p.published
  ));

-- 2. Licence / certification reference numbers stay out of public reads.
REVOKE SELECT ON public.pro_credentials FROM anon;
GRANT SELECT (id, pro_id, label, kind, verified, verified_at, expires_on, created_at)
  ON public.pro_credentials TO anon;

-- 3. Booking requests are validated against declared availability server-side.
CREATE OR REPLACE FUNCTION public.request_booking(
  p_pro_id text,
  p_slot_start timestamp with time zone,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL::text,
  p_postcode text DEFAULT NULL::text,
  p_notes text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref text;
  v_email text := lower(trim(coalesce(p_contact_email, '')));
  v_local timestamp;
  v_weekday smallint;
  v_minute integer;
  v_has_windows boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pros WHERE id = p_pro_id AND published) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_pro');
  END IF;
  IF p_slot_start IS NULL OR p_slot_start < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slot');
  END IF;
  IF p_slot_start > now() + interval '90 days' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far_ahead');
  END IF;
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;
  IF coalesce(length(trim(p_contact_name)), 0) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF length(coalesce(p_notes, '')) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'notes_too_long');
  END IF;

  -- Slot must sit inside a window the pro actually declared. Firms with no
  -- declared windows keep the standard weekday visit times.
  v_local := p_slot_start AT TIME ZONE 'Europe/London';
  v_weekday := extract(dow FROM v_local)::smallint;
  v_minute := (extract(hour FROM v_local) * 60 + extract(minute FROM v_local))::integer;

  SELECT EXISTS (SELECT 1 FROM public.pro_availability a
                  WHERE a.pro_id = p_pro_id AND a.active)
    INTO v_has_windows;

  IF v_has_windows THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pro_availability a
       WHERE a.pro_id = p_pro_id AND a.active
         AND a.weekday = v_weekday
         AND v_minute >= a.start_minute
         AND v_minute + a.slot_minutes <= a.end_minute
         AND ((v_minute - a.start_minute) % a.slot_minutes) = 0
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'outside_availability');
    END IF;
  ELSE
    IF v_weekday IN (0, 6) OR v_minute NOT IN (480, 600, 780, 900) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'outside_availability');
    END IF;
  END IF;

  IF NOT public.hit_rate_limit('booking:' || v_email, 5, 3600) THEN
    PERFORM public.log_form_block('booking', 'rate_limited_email');
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;
  IF NOT public.hit_rate_limit('booking-pro:' || p_pro_id, 20, 3600) THEN
    PERFORM public.log_form_block('booking', 'rate_limited_pro');
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  IF EXISTS (SELECT 1 FROM public.bookings
             WHERE pro_id = p_pro_id AND slot_start = p_slot_start AND status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_taken');
  END IF;

  INSERT INTO public.bookings (pro_id, user_id, slot_start, contact_name, contact_email,
                               contact_phone, postcode, notes)
  VALUES (p_pro_id, auth.uid(), p_slot_start,
          left(trim(p_contact_name), 80), v_email,
          nullif(trim(coalesce(p_contact_phone, '')), ''),
          nullif(upper(trim(coalesce(p_postcode, ''))), ''),
          left(coalesce(p_notes, ''), 2000))
  RETURNING reference INTO v_ref;

  RETURN jsonb_build_object('ok', true, 'reference', v_ref);
END;
$function$;

-- 4. Abuse protection on direct job submissions.
CREATE OR REPLACE FUNCTION public.enforce_job_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(coalesce(NEW.contact_email, '')));
BEGIN
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF length(coalesce(NEW.description, '')) > 4000 OR length(coalesce(NEW.title, '')) > 200 THEN
    RAISE EXCEPTION 'job_too_long';
  END IF;
  IF NOT public.hit_rate_limit('job:' || v_email, 5, 3600) THEN
    PERFORM public.log_form_block('post_job', 'rate_limited_email');
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF NOT public.hit_rate_limit('job-postcode:' || upper(trim(coalesce(NEW.postcode, ''))), 20, 3600) THEN
    PERFORM public.log_form_block('post_job', 'rate_limited_postcode');
    RAISE EXCEPTION 'rate_limited';
  END IF;
  NEW.contact_email := v_email;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS jobs_enforce_rate_limit ON public.jobs;
CREATE TRIGGER jobs_enforce_rate_limit
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_rate_limit();

REVOKE EXECUTE ON FUNCTION public.enforce_job_rate_limit() FROM anon, authenticated, public;