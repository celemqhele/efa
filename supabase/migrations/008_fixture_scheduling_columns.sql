-- Add fixture scheduling columns for day-of-week + time window
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS assigned_day TEXT;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS window_start TEXT;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS window_end TEXT;
