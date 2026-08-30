ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS notify_launch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_updates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS launch_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.waiting_list_trend(p_weeks integer DEFAULT 8)
RETURNS TABLE(postcode_area text, week date, signups bigint, cumulative bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g') AS area,
           date_trunc('week', w.confirmed_at)::date AS wk
      FROM public.waiting_list w
     WHERE w.confirmed_at IS NOT NULL
       AND regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g') <> ''
       AND w.confirmed_at >= now() - (greatest(least(coalesce(p_weeks, 8), 52), 1) || ' weeks')::interval
  ), grouped AS (
    SELECT area, wk, count(*) AS signups FROM base GROUP BY 1, 2
  )
  SELECT g.area,
         g.wk,
         g.signups,
         sum(g.signups) OVER (PARTITION BY g.area ORDER BY g.wk
                              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative
    FROM grouped g
   ORDER BY g.area, g.wk;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_trend(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waiting_list_trend(integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.waiting_list_area_recipients(p_area text)
RETURNS TABLE(id uuid, email text, name text, postcode text, role text,
              queue_position integer, notify_launch boolean, launch_notified_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.id, w.email, w.name, w.postcode, w.role,
         (row_number() OVER (ORDER BY w.confirmed_at, w.created_at))::integer AS queue_position,
         w.notify_launch, w.launch_notified_at
    FROM public.waiting_list w
   WHERE w.confirmed_at IS NOT NULL
     AND regexp_replace(split_part(w.postcode, ' ', 1), '[^A-Z]', '', 'g')
         = upper(regexp_replace(coalesce(p_area, ''), '[^A-Za-z]', '', 'g'))
   ORDER BY 6;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_area_recipients(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiting_list_area_recipients(text) FROM anon;
REVOKE ALL ON FUNCTION public.waiting_list_area_recipients(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_area_recipients(text) TO service_role;

CREATE OR REPLACE FUNCTION public.waiting_list_mark_launch_notified(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.waiting_list SET launch_notified_at = now() WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_mark_launch_notified(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiting_list_mark_launch_notified(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.waiting_list_mark_launch_notified(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_mark_launch_notified(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.waiting_list_set_prefs(
  p_token text, p_notify_launch boolean, p_notify_updates boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.waiting_list;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  UPDATE public.waiting_list
     SET notify_launch = coalesce(p_notify_launch, notify_launch),
         notify_updates = coalesce(p_notify_updates, notify_updates)
   WHERE confirmation_token = p_token
   RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  RETURN jsonb_build_object('ok', true,
    'notify_launch', v_row.notify_launch,
    'notify_updates', v_row.notify_updates,
    'postcode', v_row.postcode);
END;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_set_prefs(text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiting_list_set_prefs(text, boolean, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.waiting_list_set_prefs(text, boolean, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_set_prefs(text, boolean, boolean) TO service_role;
