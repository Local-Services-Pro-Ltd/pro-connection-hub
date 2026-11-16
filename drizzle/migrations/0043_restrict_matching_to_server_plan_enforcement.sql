REVOKE ALL ON FUNCTION public.match_pros(text, text, text, uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_pros(text, text, text, uuid, integer, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_pros(text, text, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_pros(text, text, text, uuid, integer, boolean) TO service_role;