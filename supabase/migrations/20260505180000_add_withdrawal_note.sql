-- Add note column to withdrawals
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS admin_note TEXT;
