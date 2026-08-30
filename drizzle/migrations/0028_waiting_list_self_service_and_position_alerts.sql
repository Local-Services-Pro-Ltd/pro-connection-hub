ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS last_position_notified integer;

CREATE OR REPLACE FUNCTION public.waiting_list_details(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.waiting_list;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT * INTO v_row FROM public.waiting_list WHERE confirmation_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'postcode', v_row.postcode,
    'trade', v_row.trade,
    'role', v_row.role,
    'confirmed', v_row.confirmed_at IS NOT NULL,
    'notify_launch', v_row.notify_launch,
    'notify_updates', v_row.notify_updates);
END;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_details(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiting_list_details(text) FROM anon;
REVOKE ALL ON FUNCTION public.waiting_list_details(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_details(text) TO service_role;

CREATE OR REPLACE FUNCTION public.waiting_list_update_details(
  p_token text, p_postcode text, p_trade text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.waiting_list;
  v_postcode text := upper(trim(coalesce(p_postcode, '')));
  v_area text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  IF length(v_postcode) < 2 OR v_postcode !~ '^[A-Z]{1,2}[0-9]' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_postcode');
  END IF;
  v_area := regexp_replace(split_part(v_postcode, ' ', 1), '[^A-Z]', '', 'g');

  UPDATE public.waiting_list
     SET postcode = v_postcode,
         postcode_area = v_area,
         trade = nullif(trim(coalesce(p_trade, '')), '')
   WHERE confirmation_token = p_token
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true,
    'postcode', v_row.postcode,
    'area', v_area,
    'trade', v_row.trade);
END;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_update_details(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiting_list_update_details(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.waiting_list_update_details(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_update_details(text, text, text) TO service_role;

DROP FUNCTION IF EXISTS public.waiting_list_area_recipients(text);

CREATE FUNCTION public.waiting_list_area_recipients(p_area text)
RETURNS TABLE(id uuid, email text, name text, postcode text, role text,
              queue_position integer, notify_launch boolean, launch_notified_at timestamptz,
              trade text, last_position_notified integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.id, w.email, w.name, w.postcode, w.role,
         (row_number() OVER (ORDER BY w.confirmed_at, w.created_at))::integer AS queue_position,
         w.notify_launch, w.launch_notified_at, w.trade, w.last_position_notified
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

CREATE OR REPLACE FUNCTION public.waiting_list_mark_position_notified(
  p_id uuid, p_position integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.waiting_list SET last_position_notified = p_position WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.waiting_list_mark_position_notified(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.waiting_list_mark_position_notified(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.waiting_list_mark_position_notified(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_mark_position_notified(uuid, integer) TO service_role;
