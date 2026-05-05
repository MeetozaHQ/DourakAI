
-- Create a migration to automatically assign admin role to getdourak@gmail.com
-- and also assign it if the user already exists.

-- 1. Update Existing User (if any)
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- We try to find the user ID from auth.users (this requires service_role or sufficient permissions)
  -- In Supabase migrations, this usually works.
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'getdourak@gmail.com';
  
  IF target_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Assigned admin role to existing user: %', target_user_id;
  END IF;
END $$;

-- 2. Update the trigger function to handle future signups of this email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  ref_user UUID;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'ref';
  IF ref_code IS NOT NULL THEN
    SELECT id INTO ref_user FROM public.profiles WHERE referral_code = ref_code LIMIT 1;
  END IF;
  
  INSERT INTO public.profiles (id, shop_name, email, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', ''),
    NEW.email,
    ref_user
  );
  
  -- Default role is owner
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  
  -- If email is the admin email, also add admin role
  IF NEW.email = 'getdourak@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;
