
-- Tighten queue_entries INSERT policy: only allow status=waiting on insert
DROP POLICY IF EXISTS "Public can join queue" ON public.queue_entries;
CREATE POLICY "Public can join queue" ON public.queue_entries
  FOR INSERT WITH CHECK (status = 'waiting');

-- Revoke direct execute on internal trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
