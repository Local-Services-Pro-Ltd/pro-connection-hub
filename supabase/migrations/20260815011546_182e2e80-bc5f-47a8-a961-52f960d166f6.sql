CREATE OR REPLACE FUNCTION public.form_block_daily(p_days integer DEFAULT 14)
RETURNS TABLE (day date, form text, reason text, hits bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day, form, reason, count(*) AS hits
  FROM public.form_block_events
  WHERE created_at >= now() - make_interval(days => greatest(coalesce(p_days, 14), 1))
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC, 4 DESC;
$function$;

REVOKE ALL ON FUNCTION public.form_block_daily(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.form_block_daily(integer) TO authenticated, service_role;