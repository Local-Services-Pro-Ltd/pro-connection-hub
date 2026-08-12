-- 1. Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles own read" ON public.user_roles;
CREATE POLICY "user_roles own read" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Grant admin to the owner account on verified signup / verification
CREATE OR REPLACE FUNCTION public.grant_admin_for_owner_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'office@allcare4u.co.uk' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_owner_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_owner_email();

-- Backfill if the account already exists and is confirmed
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'office@allcare4u.co.uk'
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. plan_visibility: admin-only writes via has_role
DROP POLICY IF EXISTS "plan_visibility admin write" ON public.plan_visibility;
CREATE POLICY "plan_visibility admin write" ON public.plan_visibility
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_visibility TO authenticated;
GRANT ALL ON public.plan_visibility TO service_role;

-- Admins can see every tier, including ones hidden from the public list
DROP POLICY IF EXISTS "plans admin read" ON public.plans;
CREATE POLICY "plans admin read" ON public.plans
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Waiting list: capture contact details for out-of-area users
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS note text;

DROP POLICY IF EXISTS "waiting_list admin read" ON public.waiting_list;
CREATE POLICY "waiting_list admin read" ON public.waiting_list
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.waiting_list TO authenticated;

DROP FUNCTION IF EXISTS public.add_to_waiting_list(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.add_to_waiting_list(
  p_email text,
  p_postcode text,
  p_role text,
  p_trade text DEFAULT NULL::text,
  p_source text DEFAULT 'waiting_list_page'::text,
  p_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
    v_id uuid;
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

    insert into public.waiting_list (email, postcode, role, trade, source, name, phone, note)
    values (lower(trim(p_email)), upper(trim(p_postcode)), p_role,
            nullif(trim(coalesce(p_trade,'')), ''), p_source,
            nullif(trim(coalesce(p_name,'')), ''),
            nullif(trim(coalesce(p_phone,'')), ''),
            nullif(trim(coalesce(p_note,'')), ''))
    on conflict (email, postcode, role) do update
        set trade = coalesce(excluded.trade, public.waiting_list.trade),
            name = coalesce(excluded.name, public.waiting_list.name),
            phone = coalesce(excluded.phone, public.waiting_list.phone),
            note = coalesce(excluded.note, public.waiting_list.note),
            metadata = public.waiting_list.metadata
                       || jsonb_build_object('last_resubmit_at', now())
    returning id into v_id;

    return v_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.add_to_waiting_list(text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;