-- Global manager reset for the new season.
-- Re-runs the logic from 063_end_all_manager_tenures.sql, which had since drifted
-- (new tenures were created after it was applied). Same intent: close every open
-- tenure and release every club, so that every manager starts a fresh tenure
-- when they are next assigned.
--
-- 1. Close every open tenure (ended_at IS NULL) with the current timestamp.
-- 2. Release every team's current manager (teams.manager_id -> NULL).
--
-- profiles.sacked_at is intentionally NOT set here. In this codebase sacked_at is
-- a 7-day reassignment COOLDOWN, not an "unemployed" flag: it is written in 3
-- places and never cleared anywhere in the codebase. Stamping it would block all
-- 60 managers who are not picking up a club this task from being assigned for a
-- week. teams.manager_id is the canonical "has a club" signal.
-- Use global_reset_sack_cooldown.sql to clear those cooldowns when needed.
--
-- abandon_count is intentionally left alone: it is lifetime club history, feeds
-- forfeit logic, and the abandonment cron alerts at >= 3. The 29 clubs handed out
-- by the poll assignment already have abandon_count = 0.

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
