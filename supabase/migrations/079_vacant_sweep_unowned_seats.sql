-- 079: Vacant-slot sweep also covers unowned seats holding a real club
--
-- 067 made sweep_vacant_slots() detect vacancies by looking for a single
-- literal placeholder team (teams.logo_league_folder='custom' AND
-- logo_team_slug='vacant'). That only ever matches seats vacated at runtime by
-- vacateUserSlots(), which overwrites the participant's team_id with the
-- placeholder.
--
-- Season 4 creates its vacant seats differently: stampFixtureParticipants()
-- inserts tournament_participants rows with the REAL club in team_id and
-- user_id = NULL, and the fixtures keep the real club ids. Those seats are
-- ownerless but were completely invisible to the sweep, so the hourly cron ran
-- and did nothing while the league stalled: a vacant club's past-due fixtures
-- never finalised and its opponents were left waiting on a result forever.
--
-- This widens the vacancy test to the actual slot definition - the participant
-- row behind the fixture's side has no owner:
--
--   * (tournament_id, team_id) participant with user_id IS NULL  -> new model
--   * side's team_id IS the legacy custom/vacant placeholder      -> 067 model
--
-- Unchanged from 067: only past-due, still-'scheduled' league/group fixtures
-- with no result row are decided, using the same 0-3 / 3-0 / 0-0 scores and the
-- same override_reason strings (which clearAutoForfeitResults() in
-- lib/slot-utils.ts matches on to withdraw them if the seat is later filled).
-- Future-dated fixtures are deliberately left alone so a manager assigned
-- later still plays them for real instead of inheriting stamped forfeits.
--
-- is_abandoned stays false and finalised_by stays NULL, so the absent club's
-- abandon_count is never incremented and the live opponent is never flagged
-- absent; the trigger's '%absent%' branch awards the 3-0 with -3GD + absent++.

CREATE OR REPLACE FUNCTION public.sweep_vacant_slots()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legacy_vacant_team uuid;
  v_count int := 0;
  v_fx record;
  v_home_vacant boolean;
  v_away_vacant boolean;
  v_home_score int;
  v_away_score int;
  v_reason text;
BEGIN
  -- Legacy 067 placeholder, kept so pre-Season-4 vacancies still resolve.
  SELECT id INTO v_legacy_vacant_team FROM teams
  WHERE logo_league_folder = 'custom' AND logo_team_slug = 'vacant'
  LIMIT 1;

  FOR v_fx IN
    SELECT
      f.id,
      (
        f.home_team_id = v_legacy_vacant_team
        OR EXISTS (
          SELECT 1 FROM tournament_participants p
          WHERE p.tournament_id = f.tournament_id
            AND p.team_id = f.home_team_id
            AND p.user_id IS NULL
        )
      ) AS home_vacant,
      (
        f.away_team_id = v_legacy_vacant_team
        OR EXISTS (
          SELECT 1 FROM tournament_participants p
          WHERE p.tournament_id = f.tournament_id
            AND p.team_id = f.away_team_id
            AND p.user_id IS NULL
        )
      ) AS away_vacant
    FROM fixtures f
    WHERE f.status = 'scheduled'
      AND f.scheduled_date IS NOT NULL
      AND f.scheduled_date <= now()
      AND f.round_type IN ('league', 'group')
      AND (
        f.home_team_id = v_legacy_vacant_team
        OR f.away_team_id = v_legacy_vacant_team
        OR EXISTS (
          SELECT 1 FROM tournament_participants p
          WHERE p.tournament_id = f.tournament_id
            AND p.team_id = f.home_team_id
            AND p.user_id IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM tournament_participants p
          WHERE p.tournament_id = f.tournament_id
            AND p.team_id = f.away_team_id
            AND p.user_id IS NULL
        )
      )
      AND NOT EXISTS (SELECT 1 FROM results r WHERE r.fixture_id = f.id)
  LOOP
    v_home_vacant := v_fx.home_vacant;
    v_away_vacant := v_fx.away_vacant;

    IF v_home_vacant AND v_away_vacant THEN
      v_home_score := 0;
      v_away_score := 0;
      v_reason := 'Both slots vacant and absent — void (0-0)';
    ELSIF v_home_vacant THEN
      v_home_score := 0;
      v_away_score := 3;
      v_reason := 'Vacant slot absent — automatic 0-3';
    ELSE
      v_home_score := 3;
      v_away_score := 0;
      v_reason := 'Vacant slot absent — automatic 3-0';
    END IF;

    INSERT INTO results (
      fixture_id, home_score, away_score, finalised_by,
      screenshot_url, override_reason,
      is_abandoned, abandoned_type, pen_home_score, pen_away_score
    ) VALUES (
      v_fx.id, v_home_score, v_away_score, NULL,
      NULL, v_reason,
      false, NULL, NULL, NULL
    )
    ON CONFLICT (fixture_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_vacant_slots() TO service_role;

-- The hourly cron (cron.schedule 'sweep-vacant-slots', '0 * * * *') is left in
-- place: it already runs every hour and simply had nothing to match before.
