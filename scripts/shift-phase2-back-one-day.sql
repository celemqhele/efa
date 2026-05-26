-- ─────────────────────────────────────────────────────────────────────────────
-- Shift every Phase 2 fixture back by 1 day.
--
-- Reason: yesterday's matches were played today, so what's currently "tomorrow"
-- on the schedule should be "today".
--
-- A "phase" in EFA = a row in the seasons table. Tournaments link to a season
-- via tournaments.season_id. Fixtures link to tournaments via tournament_id.
--
-- USAGE:
--   1. Run SECTION A to find the Phase 2 season_id.
--   2. Paste that id into SECTION B (PREVIEW) and run. Check that the new
--      JHB date column matches what you want.
--   3. Run SECTION C (APPLY) with the same season_id.
--
-- Only scheduled / awaiting_confirmation fixtures are touched — already-played
-- fixtures (confirmed / completed / abandoned) are left alone.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── SECTION A: list seasons (find the Phase 2 id) ──────────────────────────

SELECT id, name, status, start_date, end_date, created_at
FROM seasons
ORDER BY created_at DESC;


-- ── SECTION B: PREVIEW the shift ───────────────────────────────────────────
-- Replace PHASE_2_SEASON_ID below with the actual UUID from section A.

WITH phase_tournaments AS (
  SELECT id FROM tournaments
  WHERE season_id = 'PHASE_2_SEASON_ID'   -- ← paste the season id here
)
SELECT
  f.id,
  t.name AS tournament,
  to_char(f.scheduled_date AT TIME ZONE 'Africa/Johannesburg', 'Dy DD Mon HH24:MI') AS current_jhb,
  to_char((f.scheduled_date - interval '1 day') AT TIME ZONE 'Africa/Johannesburg', 'Dy DD Mon HH24:MI') AS new_jhb,
  f.status,
  f.matchday,
  h.name AS home_team,
  a.name AS away_team
FROM fixtures f
JOIN tournaments t  ON t.id = f.tournament_id
LEFT JOIN teams h   ON h.id = f.home_team_id
LEFT JOIN teams a   ON a.id = f.away_team_id
WHERE f.tournament_id IN (SELECT id FROM phase_tournaments)
  AND f.status IN ('scheduled', 'awaiting_confirmation')
ORDER BY f.scheduled_date;


-- ── SECTION C: APPLY the shift ─────────────────────────────────────────────
-- Same season id as section B.

UPDATE fixtures f
SET
  scheduled_date = scheduled_date - interval '1 day',
  deadline       = CASE WHEN deadline IS NOT NULL
                        THEN deadline - interval '1 day'
                        ELSE NULL END
FROM tournaments t
WHERE t.id = f.tournament_id
  AND t.season_id = 'PHASE_2_SEASON_ID'   -- ← same season id
  AND f.status IN ('scheduled', 'awaiting_confirmation');
