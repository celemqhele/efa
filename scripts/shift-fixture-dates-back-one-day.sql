-- ─────────────────────────────────────────────────────────────────────────────
-- Shift fixtures back by 1 day to fix off-by-one date labels
--
-- Symptom: fixtures meant for today were labelled as tomorrow
-- (Tuesday games showed as Wednesday, etc.).
--
-- Likely cause: scheduled_date was stored as a late-evening UTC time that
-- rolled over to the next JHB calendar day (e.g. "2026-05-27T00:00:00Z"
-- which is "2026-05-27 02:00 JHB" instead of "2026-05-26 22:00 JHB" or similar).
--
-- USAGE:
--   1. EDIT the WHERE clause at the bottom of section A to match the fixtures
--      you want to fix (typically: status not yet played + scheduled_date in
--      the window that's wrong).
--   2. Run section A (PREVIEW). Confirm the new_jhb_date column is what you
--      expect.
--   3. Run section B (APPLY) with the SAME WHERE clause.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── SECTION A: PREVIEW ──────────────────────────────────────────────────────
-- Shows old vs new date for everything that would be touched.

SELECT
  f.id,
  f.scheduled_date                                                AS current_utc,
  (f.scheduled_date AT TIME ZONE 'Africa/Johannesburg')::date     AS current_jhb_date,
  to_char(f.scheduled_date AT TIME ZONE 'Africa/Johannesburg',
          'Dy DD Mon HH24:MI')                                    AS current_jhb,
  (f.scheduled_date - interval '1 day')                           AS new_utc,
  ((f.scheduled_date - interval '1 day')
        AT TIME ZONE 'Africa/Johannesburg')::date                 AS new_jhb_date,
  to_char((f.scheduled_date - interval '1 day')
        AT TIME ZONE 'Africa/Johannesburg',
          'Dy DD Mon HH24:MI')                                    AS new_jhb,
  f.status,
  f.matchday,
  h.name                                                          AS home_team,
  a.name                                                          AS away_team,
  t.name                                                          AS tournament
FROM fixtures f
LEFT JOIN teams h        ON h.id = f.home_team_id
LEFT JOIN teams a        ON a.id = f.away_team_id
LEFT JOIN tournaments t  ON t.id = f.tournament_id
WHERE f.status IN ('scheduled', 'awaiting_confirmation')
  AND f.scheduled_date >= '2026-05-26'         -- ← adjust cutoff to taste
ORDER BY f.scheduled_date ASC;


-- ── SECTION B: APPLY ────────────────────────────────────────────────────────
-- IMPORTANT: WHERE clause must match SECTION A exactly.

UPDATE fixtures
SET
  scheduled_date = scheduled_date - interval '1 day',
  deadline       = CASE WHEN deadline IS NOT NULL
                        THEN deadline - interval '1 day'
                        ELSE NULL END
WHERE status IN ('scheduled', 'awaiting_confirmation')
  AND scheduled_date >= '2026-05-26';          -- ← same as preview
