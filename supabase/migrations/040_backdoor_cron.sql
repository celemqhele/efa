-- Backdoor submissions expiration cron job
-- Runs every Tuesday at 00:00 UTC to expire pending submissions

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the expiration job
SELECT cron.schedule(
  'expire-backdoor-submissions',
  '0 0 * * 2',  -- Every Tuesday at 00:00 UTC
  $$
  UPDATE backdoor_submissions 
  SET status = 'expired' 
  WHERE status = 'pending' AND expires_at < now();
  $$
);