
-- Function to safely join a queue and get a sequential number
CREATE OR REPLACE FUNCTION public.join_queue(
  p_slug TEXT, 
  p_name TEXT,
  p_queue_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop_id UUID;
  v_queue_id UUID;
  v_next_number INT;
  v_notify_token TEXT;
  v_entry_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Get Shop
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = p_slug LIMIT 1;
  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('error', 'المحل غير موجود');
  END IF;

  -- 2. Get Queue
  IF p_queue_slug IS NOT NULL THEN
    SELECT id INTO v_queue_id FROM public.queues 
    WHERE shop_id = v_shop_id AND slug = p_queue_slug AND active = true LIMIT 1;
  ELSE
    SELECT id INTO v_queue_id FROM public.queues 
    WHERE shop_id = v_shop_id AND active = true 
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_queue_id IS NULL THEN
    RETURN jsonb_build_object('error', 'لا يوجد طابور نشط');
  END IF;

  -- 3. Get Next Number
  SELECT COALESCE(MAX(number), 0) + 1 INTO v_next_number 
  FROM public.queue_entries 
  WHERE queue_id = v_queue_id;

  -- 4. Create Entry
  v_notify_token := encode(gen_random_bytes(16), 'hex');
  
  INSERT INTO public.queue_entries (queue_id, shop_id, customer_name, number, status, notify_token)
  VALUES (v_queue_id, v_shop_id, p_name, v_next_number, 'waiting', v_notify_token)
  RETURNING id INTO v_entry_id;

  -- 5. Build Result
  SELECT jsonb_build_object(
    'entry', (SELECT row_to_json(e) FROM public.queue_entries e WHERE id = v_entry_id),
    'shop', (SELECT row_to_json(s) FROM public.shops s WHERE id = v_shop_id),
    'queue', (SELECT row_to_json(q) FROM public.queues q WHERE id = v_queue_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Allow public to execute this function
GRANT EXECUTE ON FUNCTION public.join_queue(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.join_queue(TEXT, TEXT, TEXT) TO authenticated;

-- Ensure public can also insert if they want, but use the function for safety
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can join a queue" ON public.queue_entries;
CREATE POLICY "Anyone can join a queue" ON public.queue_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update their own entry" ON public.queue_entries FOR UPDATE 
USING (true) WITH CHECK (true);
