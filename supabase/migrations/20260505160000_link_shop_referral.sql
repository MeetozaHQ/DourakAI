
-- Trigger to link shop to referral on shop creation
CREATE OR REPLACE FUNCTION public.link_shop_to_referral()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.referrals 
    SET referred_shop_id = NEW.id
    WHERE referred_id = NEW.owner_id AND referred_shop_id IS NULL;
    
    -- Also set referrer_shop_id if we can find any shop owned by the referrer
    UPDATE public.referrals r
    SET referrer_shop_id = (SELECT id FROM public.shops WHERE owner_id = r.referrer_id LIMIT 1)
    WHERE referred_id = NEW.owner_id AND referrer_shop_id IS NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_shop_created
    AFTER INSERT ON public.shops
    FOR EACH ROW
    EXECUTE FUNCTION public.link_shop_to_referral();
