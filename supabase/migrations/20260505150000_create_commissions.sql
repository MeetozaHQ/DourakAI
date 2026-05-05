
-- Create commissions table
CREATE TABLE public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    referred_shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shops can view their own commissions" ON public.commissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE id = referrer_shop_id AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins manage commissions" ON public.commissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger to automatically add commission when a shop plan is upgraded to a paid one
CREATE OR REPLACE FUNCTION public.track_commission_on_upgrade()
RETURNS TRIGGER AS $$
DECLARE
    ref_record RECORD;
    plan_price NUMERIC;
BEGIN
    -- Only trigger if plan changed from 'free' to something else
    IF OLD.plan = 'free' AND NEW.plan != 'free' THEN
        -- Check if this shop was referred
        SELECT * INTO ref_record FROM public.referrals WHERE referred_shop_id = NEW.id LIMIT 1;
        
        IF FOUND THEN
            -- Get plan price (This is a bit hardcoded here, better if we had a products/plans table but we'll use a CASE for now as per lib/plans.ts)
            -- Pro: 199, Business: 499
            plan_price := CASE 
                WHEN NEW.plan = 'pro' THEN 199
                WHEN NEW.plan = 'business' THEN 499
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

CREATE TRIGGER on_shop_plan_upgrade
    AFTER UPDATE OF plan ON public.shops
    FOR EACH ROW
    EXECUTE FUNCTION public.track_commission_on_upgrade();
