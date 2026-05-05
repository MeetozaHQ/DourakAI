
-- Update referrals table to match user requirements
ALTER TABLE public.referrals 
  ADD COLUMN IF NOT EXISTS referrer_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Update the handle_new_user function to record the relationship on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  referrer_user_id UUID;
BEGIN
  -- Get ref code from metadata
  ref_code := NEW.raw_user_meta_data->>'ref';
  
  -- Try to find referrer (by profile referral_code OR shop id OR shop slug)
  IF ref_code IS NOT NULL THEN
    -- Try profile code first
    SELECT id INTO referrer_user_id FROM public.profiles WHERE referral_code = ref_code LIMIT 1;
    
    -- If not found, try shop ID
    IF referrer_user_id IS NULL THEN
      SELECT owner_id INTO referrer_user_id FROM public.shops WHERE id::text = ref_code LIMIT 1;
    END IF;
    
    -- If still not found, try shop slug
    IF referrer_user_id IS NULL THEN
      SELECT owner_id INTO referrer_user_id FROM public.shops WHERE slug = ref_code LIMIT 1;
    END IF;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (id, shop_name, email, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', ''),
    NEW.email,
    referrer_user_id
  );
  
  -- Create referral record if there is a referrer
  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, commission_percentage)
    VALUES (referrer_user_id, NEW.id, 15);
  END IF;
  
  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Special case for the admin email
  IF NEW.email = 'getdourak@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
