-- ============================================================
-- 103 - One pending postponement request per manager at a time
-- ============================================================
-- The portal lets a manager ask to move a fixture (postpone_requests). Until now
-- the only limit was per fixture (migration 096's
-- postpone_requests_pending_fixture_idx), so a manager could hold several open
-- requests across different matches at once. This adds the per-manager rule:
-- at most one 'pending' row per requested_by.
--
-- The older per-fixture index stays: it is still what stops the OPPONENT opening
-- a second request on the same match.
--
-- The companion rule (a 1-day cooldown after an APPROVED request, where only
-- approved ones count) is time-based, so it lives in the application
-- (lib/submit-match.ts POSTPONE_COOLDOWN_HOURS + requestPostpone in
-- app/api/submit-match/route.ts), not in the database.
--
-- Idempotent: safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS postpone_requests_pending_requester_idx
  ON public.postpone_requests (requested_by)
  WHERE (status = 'pending');

COMMENT ON INDEX public.postpone_requests_pending_requester_idx IS
  'At most one pending postponement request per manager (requester) at a time.';
