
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_queue_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_queue_number(UUID) TO anon, authenticated;
