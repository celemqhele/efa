-- 107: Absence results can carry a forfeit balance, so the standings trigger
-- must read the absent SIDE and the ACTUAL score instead of assuming 0-3/3-0.
--
-- Carry-over forfeit balances are now applied to every result path, including
-- absences (admin absent checkboxes, managerless/vacant auto-forfeits, the
-- both-absent 0-0 auto-finalise). Applying a balance moves the scoreline off the
-- textbook 0-3/3-0 (e.g. a 0-3 absence becomes 0-8, or even 5-3 when the
-- present side owes a 5-0), so:
--
--   1. The absent side is now recorded on `results.abandoned_type`
--      (is_abandoned stays false for absences, so the forfeit branch above this
--      one is NOT taken). The trigger prefers that marker and only falls back to
--      the old 0-3 / "anything else = away absent" score test for legacy rows.
--   2. The winner's goals-for are the ACTUAL recorded score (NEW.away_score /
--      NEW.home_score), not a hard-coded 3, so the standings match the result.
--
-- The function is patched in place off its own live definition (pattern from
-- 080_fix_both_absent_case_sensitive.sql) so this migration cannot drift from
-- the deployed body. Guards raise if the expected literals are absent, and the
-- patch is idempotent.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'update_standings_after_result';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'update_standings_after_result() not found';
  END IF;

  -- Idempotent: body already patched.
  IF v_def LIKE '%NEW.abandoned_type = ''home'' OR (NEW.abandoned_type IS NULL%' THEN
    RETURN;
  END IF;

  IF v_def NOT LIKE '%ELSIF NEW.home_score = 0 AND NEW.away_score = 3 THEN%' THEN
    RAISE EXCEPTION 'expected absence score-test not found in trigger body - review manually';
  END IF;
  IF v_def NOT LIKE '%away_gf := 3; away_ga := 0;%' THEN
    RAISE EXCEPTION 'expected hard-coded away 3-0 not found in trigger body - review manually';
  END IF;
  IF v_def NOT LIKE '%home_gf := 3; home_ga := 0;%' THEN
    RAISE EXCEPTION 'expected hard-coded home 3-0 not found in trigger body - review manually';
  END IF;

  -- Pick the absent side from the marker (new rows), falling back to the score
  -- only when the row predates the marker.
  v_def := replace(
    v_def,
    'ELSIF NEW.home_score = 0 AND NEW.away_score = 3 THEN',
    'ELSIF NEW.abandoned_type = ''home'' OR (NEW.abandoned_type IS NULL AND NEW.home_score = 0 AND NEW.away_score = 3) THEN'
  );

  -- Credit the winner with the score actually recorded.
  v_def := replace(v_def, 'away_gf := 3; away_ga := 0;', 'away_gf := NEW.away_score; away_ga := 0;');
  v_def := replace(v_def, 'home_gf := 3; home_ga := 0;', 'home_gf := NEW.home_score; home_ga := 0;');

  EXECUTE v_def;
END;
$$;
