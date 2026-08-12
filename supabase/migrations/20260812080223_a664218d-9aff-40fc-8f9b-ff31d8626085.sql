REVOKE EXECUTE ON FUNCTION public.grant_admin_for_owner_email() FROM anon, authenticated, public;

-- Sign-ups now go through the app server (which rate-limits and human-checks
-- first), so the raw RPC no longer needs to be reachable from the browser.
REVOKE EXECUTE ON FUNCTION public.add_to_waiting_list(text, text, text, text, text, text, text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.add_to_waiting_list(text, text, text, text, text, text, text, text) TO service_role;