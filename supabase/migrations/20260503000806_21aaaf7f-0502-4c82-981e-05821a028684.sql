-- Branches table (Business plan)
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_branches_shop ON public.branches(shop_id);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own branches" ON public.branches
  FOR ALL USING (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = branches.shop_id AND shops.owner_id = auth.uid()));

CREATE POLICY "Admins manage all branches" ON public.branches
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Staff accounts table (Business plan)
CREATE TYPE public.staff_role AS ENUM ('manager', 'cashier');

CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.staff_role NOT NULL DEFAULT 'cashier',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, email)
);

CREATE INDEX idx_staff_shop ON public.staff(shop_id);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own staff" ON public.staff
  FOR ALL USING (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = staff.shop_id AND shops.owner_id = auth.uid()));

CREATE POLICY "Admins manage all staff" ON public.staff
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();