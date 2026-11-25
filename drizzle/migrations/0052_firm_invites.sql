-- "Invite a firm": an admin emails a listed firm a personal, one-time link to
-- take over its listing.
--
--   invited_email      the address the invitation was sent to; only an account
--                      with this confirmed address can accept
--   invited_at         when the latest invitation was sent
--   invite_token_hash  SHA-256 of the one-time token (the token itself is only
--                      ever in the email); cleared when the invitation is used
--   invite_expires_at  30 days after sending
--
-- The public and signed-in roles read `pros` through column-level grants, so
-- these columns are not readable by browsers. They are written only by the
-- server with the service role. Signed-in users hold a table-wide UPDATE grant
-- on `pros`, so take these four columns out of it explicitly.

ALTER TABLE public.pros
  ADD COLUMN IF NOT EXISTS invited_email text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_token_hash text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS pros_invite_token_hash_key
  ON public.pros (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

-- Nobody but the server may set or change an invitation.
CREATE OR REPLACE FUNCTION public.guard_pro_invite_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.invited_email := NULL;
    NEW.invited_at := NULL;
    NEW.invite_token_hash := NULL;
    NEW.invite_expires_at := NULL;
  ELSE
    NEW.invited_email := OLD.invited_email;
    NEW.invited_at := OLD.invited_at;
    NEW.invite_token_hash := OLD.invite_token_hash;
    NEW.invite_expires_at := OLD.invite_expires_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_pro_invite_fields_trg ON public.pros;
CREATE TRIGGER guard_pro_invite_fields_trg
  BEFORE INSERT OR UPDATE ON public.pros
  FOR EACH ROW EXECUTE FUNCTION public.guard_pro_invite_fields();
