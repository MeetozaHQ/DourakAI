
-- Cleanup: Keep only the oldest shop for each owner
DELETE FROM public.shops 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
        FROM public.shops
    ) as sub WHERE rn = 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.shops ADD CONSTRAINT shops_owner_id_key UNIQUE (owner_id);
