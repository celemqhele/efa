-- 080: Case-insensitive "both absent" detection in the result trigger
--
-- Surfaced by 079: with vacant seats now auto-decided, a fixture between two
-- vacant clubs (Lerumo Lions v Upington City) was recorded as a 3-0 home win
-- instead of a 0-0 void.
--
-- Root cause: update_standings_after_result() (migration 065) picks the
-- no-show branch with `v_reason LIKE '%absent%'` and then splits it with
-- `v_reason LIKE '%both%'`. Postgres LIKE is CASE-SENSITIVE, and the sweep's
-- reason string is 'Both slots vacant and absent — void (0-0)' - capital B.
-- So '%both%' did not match, control fell through to the trailing
-- "Away absent (score = 3-0)" branch, and the home club was handed a win it
-- never played for.
--
-- The fix is ILIKE (case-insensitive) on both tests rather than rewording the
-- sweep's reason string, because lib/slot-utils.ts clearAutoForfeitResults()
-- matches that string with case-sensitive startsWith('Both slots vacant') to
-- withdraw the auto-forfeits when the seat is later filled. Keeping the string
-- as-is and making the trigger tolerant is the safer pairing.
--
-- The function is patched in place off its own live definition instead of
-- re-declared here, so this migration cannot drift from the deployed body.
-- pg_get_functiondef() emits CREATE OR REPLACE, so the trigger object
-- on_result_insert stays attached to the same function OID. The guard raises
-- if the expected literals are ever absent, so this can never fail silently.

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

  -- Idempotent: if the body is already patched there is nothing to do.
  IF v_def LIKE '%v_reason ILIKE ''%absent%''%' THEN
    RETURN;
  END IF;

  IF v_def NOT LIKE '%v_reason LIKE ''%absent%''%' THEN
    RAISE EXCEPTION 'expected absent-literal not found in trigger body - review manually';
  END IF;

  v_def := replace(v_def, 'v_reason LIKE ''%absent%''', 'v_reason ILIKE ''%absent%''');
  v_def := replace(v_def, 'v_reason LIKE ''%both%''',  'v_reason ILIKE ''%both%''');

  EXECUTE v_def;
END;
$$;

-- Repair the one fixture 079 decided with the old (wrong) branch.
--
-- trigger_recalc_on_result() only rebuilds manager_tenures stats, so deleting
-- a result does NOT roll league standings back - the two rows have to be reset
-- explicitly before the fixture is re-decided. Scoped to the exact fixture and
-- to rows whose record consists solely of that fixture (played = 1, and the
-- other side's standing is what it should be), so this is a no-op on re-run
-- and can never clobber real results.
DO $$
DECLARE
  v_fx uuid := 'e1fa0b82-ada4-40ac-bbbc-7e3d2135cb47';
  v_tour uuid;
  v_reset int;
BEGIN
  SELECT tournament_id INTO v_tour FROM fixtures WHERE id = v_fx;
  IF v_tour IS NULL THEN
    RETURN;
  END IF;

  -- goal_difference is a GENERATED ALWAYS column (goals_for - goals_against),
  -- so zeroing the two inputs resets it implicitly and it must not be set here.
  UPDATE standings s
  SET played = 0, wins = 0, draws = 0, losses = 0,
      goals_for = 0, goals_against = 0, points = 0,
      form = '', unbeaten_run = 0, clean_sheets = 0, absent = 0, gd_penalty = 0
  WHERE s.tournament_id = v_tour
    AND s.team_id IN (SELECT home_team_id FROM fixtures WHERE id = v_fx
                      UNION ALL
                      SELECT away_team_id FROM fixtures WHERE id = v_fx)
    -- Safe to zero only if this fixture is that side's ONLY result, so the row
    -- is provably just the one mis-decided match. Does not encode which branch
    -- misfired: the wrong "away absent" branch gave the home side wins=1/pts=3
    -- and the away side absent=1, so the buggy shape is asymmetric.
    AND s.played = 1
    AND 1 = (SELECT count(*)
             FROM results r2
             JOIN fixtures f2 ON f2.id = r2.fixture_id
             WHERE f2.tournament_id = v_tour
               AND (f2.home_team_id = s.team_id OR f2.away_team_id = s.team_id));

  GET DIAGNOSTICS v_reset = ROW_COUNT;

  DELETE FROM results WHERE fixture_id = v_fx;

  -- Deleting the result leaves the fixture in 'confirmed', and the sweep only
  -- considers 'scheduled' rows, so the fixture has to be reopened explicitly or
  -- the re-decide below silently matches nothing. (clearAutoForfeitResults() in
  -- lib/slot-utils.ts does the same reset, but only for 'confirmed_pending'.)
  UPDATE fixtures
  SET status = 'scheduled'
  WHERE id = v_fx
    AND status <> 'scheduled';

  RAISE NOTICE 'repaired % standing row(s) and reopened fixture %', v_reset, v_fx;
END;
$$;

-- Re-decide the repaired fixture with the corrected trigger. The 0-0 void now
-- takes the '%both%' branch: played +1 for both, no W/D/L, no points,
-- absent +1 and gd_penalty -3 for both.
SELECT public.sweep_vacant_slots();
