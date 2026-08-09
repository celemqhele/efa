-- Add sacked_at to profiles to track the 1-week manager reassignment cooldown
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sacked_at timestamptz;
