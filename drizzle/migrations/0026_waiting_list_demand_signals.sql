-- Aggregate, privacy-safe demand per postcode area. Confirmed sign-ups only,
-- counts never expose an individual, so this is safe for the public site.
CREATE OR REPLACE FUNCTION public.waiting_list_demand()
RETURNS TABLE(postcode_area text, homeowners bigint, traders bigint, total bigint, first_signup timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g') AS postcode_area,
         count(*) FILTER (WHERE w.role = 'homeowner') AS homeowners,
         count(*) FILTER (WHERE w.role = 'trader') AS traders,
         count(*) AS total,
         min(w.created_at) AS first_signup
    FROM public.waiting_list w
   WHERE w.confirmed_at IS NOT NULL
     AND regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g') <> ''
   GROUP BY 1
   ORDER BY 4 DESC, 1;
$function$;

GRANT EXECUTE ON FUNCTION public.waiting_list_demand() TO anon, authenticated;

-- Count for one postcode area, used on the confirmation screen.
CREATE OR REPLACE FUNCTION public.waiting_list_area_total(p_area text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)
    FROM public.waiting_list w
   WHERE w.confirmed_at IS NOT NULL
     AND regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g')
         = upper(regexp_replace(coalesce(p_area, ''), '[^A-Za-z]', '', 'g'));
$function$;

GRANT EXECUTE ON FUNCTION public.waiting_list_area_total(text) TO anon, authenticated;

-- Admin-only breakdown: includes unconfirmed sign-ups and trade demand.
CREATE OR REPLACE FUNCTION public.waiting_list_admin_summary()
RETURNS TABLE(postcode_area text, total bigint, confirmed bigint, homeowners bigint, traders bigint, trades text, last_signup timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.security_caller_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g') AS postcode_area,
         count(*) AS total,
         count(*) FILTER (WHERE w.confirmed_at IS NOT NULL) AS confirmed,
         count(*) FILTER (WHERE w.role = 'homeowner') AS homeowners,
         count(*) FILTER (WHERE w.role = 'trader') AS traders,
         string_agg(DISTINCT w.trade, ', ') FILTER (WHERE w.trade IS NOT NULL) AS trades,
         max(w.created_at) AS last_signup
    FROM public.waiting_list w
   GROUP BY 1
   ORDER BY 2 DESC, 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.waiting_list_admin_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.waiting_list_admin_summary() TO authenticated;