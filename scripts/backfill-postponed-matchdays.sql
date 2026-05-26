-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: re-assign matchday for already-postponed fixtures based on their
-- current scheduled_date. Mirrors the logic in lib/matchday-resolver.ts.
--
-- Strategy per fixture:
--   1. If another fixture in the same tournament plays on the same calendar
--      day (in Africa/Johannesburg time), use that matchday — closest by time.
--   2. Otherwise, slot into the earliest matchday whose first fixture is on
--      or after this fixture's scheduled_date.
--   3. Otherwise, max(matchday in tournament) + 1.
--
-- Applies sequentially so later fixtures see prior reassignments.
-- Run as a one-time backfill. Safe to re-run: only updates rows that change.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  fx        RECORD;
  target_md INTEGER;
  jhb_tz    CONSTANT TEXT := 'Africa/Johannesburg';
  moved     INTEGER := 0;
  scanned   INTEGER := 0;
BEGIN
  FOR fx IN
    SELECT id, tournament_id, scheduled_date, matchday
    FROM fixtures
    WHERE is_postponed = true
      AND status IN ('scheduled', 'awaiting_confirmation')
      AND tournament_id IS NOT NULL
      AND scheduled_date IS NOT NULL
    ORDER BY scheduled_date ASC
  LOOP
    scanned := scanned + 1;
    target_md := NULL;

    -- Step 1: same calendar day (JHB) as another fixture → use its matchday
    SELECT other.matchday
      INTO target_md
    FROM fixtures other
    WHERE other.tournament_id = fx.tournament_id
      AND other.id <> fx.id
      AND other.matchday IS NOT NULL
      AND other.scheduled_date IS NOT NULL
      AND (other.scheduled_date AT TIME ZONE jhb_tz)::date
          = (fx.scheduled_date AT TIME ZONE jhb_tz)::date
    ORDER BY
      abs(extract(epoch FROM (other.scheduled_date - fx.scheduled_date))) ASC,
      other.matchday ASC
    LIMIT 1;

    -- Step 2: earliest matchday whose first fixture date >= new date
    IF target_md IS NULL THEN
      SELECT m.md
        INTO target_md
      FROM (
        SELECT matchday AS md, MIN(scheduled_date) AS min_date
        FROM fixtures
        WHERE tournament_id = fx.tournament_id
          AND id <> fx.id
          AND matchday IS NOT NULL
          AND scheduled_date IS NOT NULL
        GROUP BY matchday
      ) m
      WHERE m.min_date >= fx.scheduled_date
      ORDER BY m.min_date ASC, m.md ASC
      LIMIT 1;
    END IF;

    -- Step 3: past everything → new matchday number
    IF target_md IS NULL THEN
      SELECT COALESCE(MAX(matchday), fx.matchday) + 1
        INTO target_md
      FROM fixtures
      WHERE tournament_id = fx.tournament_id
        AND id <> fx.id;
    END IF;

    -- Apply only if it actually changes
    IF target_md IS DISTINCT FROM fx.matchday THEN
      RAISE NOTICE 'Fixture % : MD% → MD% (date %)',
        fx.id, fx.matchday, target_md, fx.scheduled_date;
      UPDATE fixtures SET matchday = target_md WHERE id = fx.id;
      moved := moved + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE 'Scanned: % postponed fixture(s)', scanned;
  RAISE NOTICE 'Moved:   % to new matchday',     moved;
  RAISE NOTICE '─────────────────────────────────────────────';
END $$;
