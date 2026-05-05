
-- Fix commission prices and create withdrawals table

-- 1. Update the commission tracking function with correct prices (100 and 300 EGP)
CREATE OR REPLACE FUNCTION public.track_commission_on_upgrade()
RETURNS TRIGGER AS $$
DECLARE
    ref_record RECORD;
    plan_price NUMERIC;
BEGIN
    -- Only trigger if plan changed from 'free' to something else
    IF (OLD.plan IS NULL OR OLD.plan = 'free') AND NEW.plan != 'free' THEN
        -- Check if this shop was referred
        SELECT * INTO ref_record FROM public.referrals WHERE referred_shop_id = NEW.id LIMIT 1;
        
        IF FOUND THEN
            -- Get correct plan price based on lib/plans.ts
            -- Pro: 100, Business: 300
            plan_price := CASE 
                WHEN NEW.plan = 'pro' THEN 100
                WHEN NEW.plan = 'business' THEN 300
                ELSE 0
            END;

            IF plan_price > 0 THEN
                INSERT INTO public.commissions (referrer_shop_id, referred_shop_id, amount, status)
                VALUES (ref_record.referrer_shop_id, NEW.id, plan_price * 0.15, 'pending');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create withdrawals table
CREATE TABLE public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    phone_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS for withdrawals
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shops can view and create their own withdrawals" ON public.withdrawals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE id = shop_id AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins manage withdrawals" ON public.withdrawals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
