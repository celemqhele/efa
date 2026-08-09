-- Backdoor submission status expiry
-- 1) Allow all statuses the app uses (cron sets 'expired', finalise-result sets 'void_game_played')
ALTER TABLE public.backdoor_submissions
  DROP CONSTRAINT IF EXISTS backdoor_submissions_status_check,
  ADD CONSTRAINT backdoor_submissions_status_check
    CHECK (status = ANY (ARRAY['pending', 'approved', 'declined', 'void_game_played', 'expired']));

-- 2) Reschedule expiry to run daily and also expire reviewed submissions after 7 days
SELECT cron.unschedule('expire-backdoor-submissions');

SELECT cron.schedule(
  'expire-backdoor-submissions',
  '0 0 * * *',
  $$
  UPDATE public.backdoor_submissions
  SET status = 'expired'
  WHERE status IN ('pending', 'approved', 'declined', 'void_game_played')
    AND (
      (status = 'pending' AND expires_at < now())
      OR (status <> 'pending' AND COALESCE(reviewed_at, created_at) < now() - interval '7 days')
    );
  $$
);
