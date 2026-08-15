-- Onboarding + admin manager-assignment flow
-- 1) Allow team-less onboarding applications in manager_applications
ALTER TABLE public.manager_applications
  ALTER COLUMN team_id DROP NOT NULL;

-- 2) Applications expire after 7 days
ALTER TABLE public.manager_applications
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing rows (pending ones stay valid from creation)
UPDATE public.manager_applications
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL;

-- 3) Add 'expired' to the status check
ALTER TABLE public.manager_applications
  DROP CONSTRAINT IF EXISTS manager_applications_status_check,
  ADD CONSTRAINT manager_applications_status_check
    CHECK (status = ANY (ARRAY['pending', 'approved', 'denied', 'expired']));

-- 4) Daily cron to expire stale applications (mirrors 051_backdoor_status_expiry.sql)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-manager-applications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'expire-manager-applications',
  '0 0 * * *',
  $$
  UPDATE public.manager_applications
  SET status = 'expired', reviewed_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
  $$
);

-- 5) New whatsapp_sessions columns for the onboarding + admin assign flows
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS onboarding_username text,
  ADD COLUMN IF NOT EXISTS admin_assign_applicants jsonb,
  ADD COLUMN IF NOT EXISTS admin_assign_team_list jsonb,
  ADD COLUMN IF NOT EXISTS admin_assign_selected_applicant_id uuid,
  ADD COLUMN IF NOT EXISTS admin_assign_selected_team_id uuid;
