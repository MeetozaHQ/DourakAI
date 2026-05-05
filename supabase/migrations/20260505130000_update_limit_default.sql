
-- Update default daily limit to 10 for new shops
ALTER TABLE public.shops ALTER COLUMN daily_limit SET DEFAULT 10;

-- Update existing free shops to have the new limit if it was still 20
UPDATE public.shops SET daily_limit = 10 WHERE plan = 'free' AND daily_limit = 20;
