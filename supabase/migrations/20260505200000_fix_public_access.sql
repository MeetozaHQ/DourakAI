
-- Ensure shops have active=true by default and are publicly readable
ALTER TABLE public.shops ALTER COLUMN active SET DEFAULT true;
UPDATE public.shops SET active = true WHERE active IS NULL;

-- Enable public read for shops
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shops are publicly readable" ON public.shops;
CREATE POLICY "Shops are publicly readable" ON public.shops
FOR SELECT USING (true);

-- Ensure queue_entries have served_at/done_at for stats
-- (Note: served_at already exists in the type Entry, let's ensure the table is ready for public queuing)
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Queue entries are publicly readable" ON public.queue_entries;
CREATE POLICY "Queue entries are publicly readable" ON public.queue_entries
FOR SELECT USING (true);
