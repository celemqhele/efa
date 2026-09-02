-- End all manager tenures across all accounts.
-- Mirrors the cleanup done by app/api/admin/end-season/route.ts, applied globally.
--
-- 1. Close every open tenure (ended_at IS NULL) with the current timestamp.
-- 2. Release every team's current manager (teams.manager_id -> NULL).
--
-- sacked_at is intentionally NOT set: that would trigger the 7-day reassignment
-- cooldown, which would prevent any manager from being reassigned for a week.

WITH closed AS (
  UPDATE public.manager_tenures
  SET ended_at = now()
  WHERE ended_at IS NULL
  RETURNING id
)
SELECT count(*) AS tenures_ended FROM closed;

UPDATE public.teams
SET manager_id = NULL
WHERE manager_id IS NOT NULL;