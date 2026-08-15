-- 1. Waiting list double opt-in fields
ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- Existing rows predate double opt-in; treat them as confirmed.
UPDATE public.waiting_list SET confirmed_at = COALESCE(confirmed_at, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS waiting_list_confirmation_token_key
  ON public.waiting_list (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

-- 2. Sign-up entry point now returns id + confirmation state + token
DROP FUNCTION IF EXISTS public.add_to_waiting_list(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.add_to_waiting_list(
  p_email text,
  p_postcode text,
  p_role text,
  p_trade text DEFAULT NULL,
  p_source text DEFAULT 'waiting_list_page',
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    v_id uuid;
    v_token text;
    v_confirmed timestamptz;
begin
    if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid_email';
    end if;
    if p_postcode is null or length(trim(p_postcode)) < 2 then
        raise exception 'invalid_postcode';
    end if;
    if p_role not in ('homeowner','trader') then
        raise exception 'invalid_role';
    end if;

    v_token := encode(gen_random_bytes(24), 'hex');

    insert into public.waiting_list (email, postcode, role, trade, source, name, phone, note, confirmation_token)
    values (lower(trim(p_email)), upper(trim(p_postcode)), p_role,
            nullif(trim(coalesce(p_trade,'')), ''), p_source,
            nullif(trim(coalesce(p_name,'')), ''),
            nullif(trim(coalesce(p_phone,'')), ''),
            nullif(trim(coalesce(p_note,'')), ''),
            v_token)
    on conflict (email, postcode, role) do update
        set trade = coalesce(excluded.trade, public.waiting_list.trade),
            name = coalesce(excluded.name, public.waiting_list.name),
            phone = coalesce(excluded.phone, public.waiting_list.phone),
            note = coalesce(excluded.note, public.waiting_list.note),
            confirmation_token = case
              when public.waiting_list.confirmed_at is null then excluded.confirmation_token
              else public.waiting_list.confirmation_token end,
            metadata = public.waiting_list.metadata
                       || jsonb_build_object('last_resubmit_at', now())
    returning id, confirmation_token, confirmed_at into v_id, v_token, v_confirmed;

    return jsonb_build_object(
      'id', v_id,
      'token', v_token,
      'confirmed', v_confirmed is not null
    );
end;
$function$;

REVOKE ALL ON FUNCTION public.add_to_waiting_list(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_waiting_list(text, text, text, text, text, text, text, text) TO service_role;

-- Mark the confirmation email as sent
CREATE OR REPLACE FUNCTION public.mark_waiting_list_email_sent(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.waiting_list SET confirmation_sent_at = now() WHERE id = p_id;
$function$;

REVOKE ALL ON FUNCTION public.mark_waiting_list_email_sent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_waiting_list_email_sent(uuid) TO service_role;

-- 3. Confirmation (double opt-in)
CREATE OR REPLACE FUNCTION public.confirm_waiting_list(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    v_row public.waiting_list;
begin
    if p_token is null or length(p_token) < 16 then
        return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;

    select * into v_row from public.waiting_list where confirmation_token = p_token;
    if not found then
        return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;

    if v_row.confirmed_at is null then
        update public.waiting_list set confirmed_at = now() where id = v_row.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'already', v_row.confirmed_at is not null,
      'postcode', v_row.postcode,
      'role', v_row.role
    );
end;
$function$;

REVOKE ALL ON FUNCTION public.confirm_waiting_list(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_waiting_list(text) TO service_role;

-- 4. Blocked submission log
CREATE TABLE IF NOT EXISTS public.form_block_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.form_block_events TO authenticated;
GRANT ALL ON public.form_block_events TO service_role;

ALTER TABLE public.form_block_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_block_events admin read" ON public.form_block_events;
CREATE POLICY "form_block_events admin read"
  ON public.form_block_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS form_block_events_created_at_idx
  ON public.form_block_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_form_block(p_form text, p_reason text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  INSERT INTO public.form_block_events (form, reason) VALUES (left(p_form, 40), left(p_reason, 40));
$function$;

REVOKE ALL ON FUNCTION public.log_form_block(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_form_block(text, text) TO service_role;

-- 5. Daily totals for the admin dashboard (admins only)
CREATE OR REPLACE FUNCTION public.form_block_daily(p_days integer DEFAULT 14)
RETURNS TABLE (day date, form text, reason text, hits bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day, form, reason, count(*) AS hits
  FROM public.form_block_events
  WHERE public.has_role(auth.uid(), 'admin')
    AND created_at >= now() - make_interval(days => greatest(coalesce(p_days, 14), 1))
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC, 4 DESC;
$function$;

REVOKE ALL ON FUNCTION public.form_block_daily(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.form_block_daily(integer) TO authenticated, service_role;