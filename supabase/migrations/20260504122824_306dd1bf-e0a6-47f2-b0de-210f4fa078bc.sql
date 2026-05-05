
-- queues: add slug + branch
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- backfill slugs for existing queues
UPDATE public.queues
SET slug = 'q-' || substr(md5(id::text), 1, 8)
WHERE slug IS NULL;

ALTER TABLE public.queues ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.queues ALTER COLUMN slug SET DEFAULT ('q-' || substr(md5((random())::text), 1, 8));

-- unique slug per shop
CREATE UNIQUE INDEX IF NOT EXISTS queues_shop_slug_unique ON public.queues(shop_id, slug);

-- staff: assignable to a specific queue
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL;
