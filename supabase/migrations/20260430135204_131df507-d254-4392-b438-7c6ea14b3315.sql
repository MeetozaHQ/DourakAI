
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'owner');
CREATE TYPE public.plan_type AS ENUM ('free', 'pro', 'business');
CREATE TYPE public.entry_status AS ENUM ('waiting', 'serving', 'done', 'left');
CREATE TYPE public.subscription_status AS ENUM ('active', 'pending', 'cancelled', 'expired');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  referral_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- SHOPS
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE DEFAULT ('shop-' || substr(md5(random()::text), 1, 8)),
  plan plan_type NOT NULL DEFAULT 'free',
  brand_color TEXT DEFAULT '#6366f1',
  logo_url TEXT,
  daily_limit INTEGER DEFAULT 20,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- QUEUES
CREATE TABLE public.queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'الطابور الرئيسي',
  current_serving INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- QUEUE ENTRIES
CREATE TABLE public.queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  status entry_status NOT NULL DEFAULT 'waiting',
  notify_token TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 12),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  served_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  wait_seconds INTEGER
);

CREATE INDEX idx_entries_queue_status ON public.queue_entries(queue_id, status);
CREATE INDEX idx_entries_shop_date ON public.queue_entries(shop_id, joined_at);

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan plan_type NOT NULL,
  status subscription_status NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- REFERRALS
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- HAS_ROLE FUNCTION (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- PROFILES POLICIES
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER ROLES POLICIES (only admins can manage)
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SHOPS POLICIES
CREATE POLICY "Public can view active shops" ON public.shops FOR SELECT USING (active = true);
CREATE POLICY "Owners view own shops" ON public.shops FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all shops" ON public.shops FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners manage own shops" ON public.shops FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Admins manage all shops" ON public.shops FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- QUEUES POLICIES
CREATE POLICY "Public view queues" ON public.queues FOR SELECT USING (true);
CREATE POLICY "Owners manage own queues" ON public.queues FOR ALL USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = queues.shop_id AND shops.owner_id = auth.uid())
);
CREATE POLICY "Admins manage queues" ON public.queues FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- QUEUE ENTRIES POLICIES
CREATE POLICY "Public view entries" ON public.queue_entries FOR SELECT USING (true);
CREATE POLICY "Public can join queue" ON public.queue_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners manage entries" ON public.queue_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = queue_entries.shop_id AND shops.owner_id = auth.uid())
);
CREATE POLICY "Admins manage entries" ON public.queue_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SUBSCRIPTIONS POLICIES
CREATE POLICY "Owners view own subs" ON public.subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = subscriptions.shop_id AND shops.owner_id = auth.uid())
);
CREATE POLICY "Owners create subs" ON public.subscriptions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops WHERE shops.id = subscriptions.shop_id AND shops.owner_id = auth.uid())
);
CREATE POLICY "Admins manage subs" ON public.subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- REFERRALS POLICIES
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- TRIGGER: auto-create profile on signup
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
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: get next queue number
CREATE OR REPLACE FUNCTION public.next_queue_number(_queue_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(number), 0) + 1 INTO next_num
  FROM public.queue_entries
  WHERE queue_id = _queue_id
    AND joined_at::date = CURRENT_DATE;
  RETURN next_num;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
ALTER TABLE public.queues REPLICA IDENTITY FULL;
