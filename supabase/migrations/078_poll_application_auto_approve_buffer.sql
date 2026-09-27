-- Poll picks: replace the indefinite "pending" limbo with a 24-hour change window.
--
-- Behaviour wanted by the admin:
--   * A user picks a team -> status 'pending' with auto_approve_at = now() + 24h.
--   * Until that moment elapses they may withdraw and re-pick; because withdrawal is a
--     hard DELETE (see app/api/polls/[share_code]/withdraw/route.ts and the
--     "READ BEFORE TOUCHING ANYCODE.md" note) a re-apply INSERTS a fresh row, which
--     restarts the 24h timer from the new pick.
--   * Once auto_approve_at passes, a cron flips the row to 'approved' and the user can
--     no longer withdraw.
--
-- Existing pending rows are backfilled from created_at so their timers start from the
-- original pick time rather than from the moment this migration runs.
ALTER TABLE public.poll_applications
  ADD COLUMN IF NOT EXISTS auto_approve_at timestamptz;

UPDATE public.poll_applications
SET auto_approve_at = created_at + interval '24 hours'
WHERE status = 'pending' AND auto_approve_at IS NULL;

CREATE INDEX IF NOT EXISTS poll_applications_auto_approve_idx
  ON public.poll_applications (status, auto_approve_at)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.poll_applications TO service_role, anon, authenticated;
