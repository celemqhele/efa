-- Fix: update_standings_after_result() group branch never set fixtures.status.
--
-- Vacancy auto-forfeit (vacateUserSlots in lib/slot-utils.ts) inserts a 0-3 /
-- 0-0 result for a vacated seat's remaining league/group fixtures. The
-- confirmed_pending guard above (from 066) handles FUTURE-dated fixtures, but
-- today-or-past-due GROUP fixtures fell through into the group branch, which
-- upserted group_standings and RETURNed WITHOUT setting fixtures.status to
-- 'confirmed' — leaving the fixture stuck on 'scheduled' (standings applied,
-- result never visible as decided). The league path below already updates
-- status='confirmed' before returning (line flagged in 066); this recreates
-- the function so the group branch does the same.

CREATE OR REPLACE FUNCTION public.update_standings_after_result()
RETURNS TRIGGER AS $$
DECLARE
  v_fixture fixtures%ROWTYPE;
  v_tournament_type text;
  v_group_name text;
  v_home_participant uuid;
  v_away_participant uuid;
  home_gf int;
  home_ga int;
  away_gf int;
  away_ga int;
  home_outcome text;
  away_outcome text;
  home_current standings%ROWTYPE;
  away_current standings%ROWTYPE;
  v_new_form_home text;
  v_new_form_away text;
  home_absent_inc int := 0;
  away_absent_inc int := 0;
  home_gdp_inc int := 0;
  away_gdp_inc int := 0;
  v_reason text;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE fixtures.id = NEW.fixture_id;
  SELECT type INTO v_tournament_type FROM tournaments WHERE tournaments.id = v_fixture.tournament_id;
  v_reason := COALESCE(NEW.override_reason, '');

  -- CONFIRMED PENDING guard: future-dated results captured but deferred
  IF v_fixture.scheduled_date IS NOT NULL
     AND (v_fixture.scheduled_date)::date > CURRENT_DATE THEN
    UPDATE fixtures SET status = 'confirmed_pending' WHERE id = NEW.fixture_id;
    RETURN NEW;
  END IF;

  -- Resolve slot owners (from fixture participant refs, falling back to team)
  v_home_participant := v_fixture.home_participant_id;
  IF v_home_participant IS NULL AND v_fixture.home_team_id IS NOT NULL THEN
    SELECT id INTO v_home_participant FROM tournament_participants
    WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.home_team_id LIMIT 1;
    IF v_home_participant IS NULL THEN
      INSERT INTO tournament_participants (tournament_id, team_id)
      VALUES (v_fixture.tournament_id, v_fixture.home_team_id)
      ON CONFLICT DO NOTHING;
      SELECT id INTO v_home_participant FROM tournament_participants
      WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.home_team_id LIMIT 1;
    END IF;
  END IF;

  v_away_participant := v_fixture.away_participant_id;
  IF v_away_participant IS NULL AND v_fixture.away_team_id IS NOT NULL THEN
    SELECT id INTO v_away_participant FROM tournament_participants
    WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.away_team_id LIMIT 1;
    IF v_away_participant IS NULL THEN
      INSERT INTO tournament_participants (tournament_id, team_id)
      VALUES (v_fixture.tournament_id, v_fixture.away_team_id)
      ON CONFLICT DO NOTHING;
      SELECT id INTO v_away_participant FROM tournament_participants
      WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.away_team_id LIMIT 1;
    END IF;
  END IF;

  -- Outcome / GF / GA / absent-penalty resolution (unchanged logic)
  IF NEW.is_abandoned THEN
    IF NEW.abandoned_type = 'home' THEN
      home_outcome := 'L'; away_outcome := 'W';
      home_gf := NEW.home_score; home_ga := NEW.away_score;
      away_gf := NEW.away_score; away_ga := NEW.home_score;
      home_absent_inc := 1; home_gdp_inc := -3;
    ELSIF NEW.abandoned_type = 'away' THEN
      home_outcome := 'W'; away_outcome := 'L';
      home_gf := NEW.home_score; home_ga := NEW.away_score;
      away_gf := NEW.away_score; away_ga := NEW.home_score;
      away_absent_inc := 1; away_gdp_inc := -3;
    ELSE
      home_outcome := 'L'; away_outcome := 'L';
      home_gf := 0; home_ga := 0; away_gf := 0; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
      away_absent_inc := 1; away_gdp_inc := -3;
    END IF;
  ELSIF v_reason LIKE '%absent%' THEN
    IF v_reason LIKE '%both%' THEN
      home_outcome := 'A'; away_outcome := 'A';
      home_gf := 0; home_ga := 0; away_gf := 0; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
      away_absent_inc := 1; away_gdp_inc := -3;
    ELSIF NEW.home_score = 0 AND NEW.away_score = 3 THEN
      home_outcome := 'A'; away_outcome := 'W';
      home_gf := 0; home_ga := 0; away_gf := 3; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
    ELSE
      home_outcome := 'W'; away_outcome := 'A';
      home_gf := 3; home_ga := 0; away_gf := 0; away_ga := 0;
      away_absent_inc := 1; away_gdp_inc := -3;
    END IF;
  ELSE
    home_gf := NEW.home_score; home_ga := NEW.away_score;
    away_gf := NEW.away_score; away_ga := NEW.home_score;
    IF NEW.home_score > NEW.away_score THEN
      home_outcome := 'W'; away_outcome := 'L';
    ELSIF NEW.home_score < NEW.away_score THEN
      home_outcome := 'L'; away_outcome := 'W';
    ELSE
      home_outcome := 'D'; away_outcome := 'D';
    END IF;
  END IF;

  -- Group stage: resolve group from the slot, upsert by participant
  IF v_fixture.round_type = 'group' THEN
    SELECT group_name INTO v_group_name
    FROM tournament_participants WHERE id = v_home_participant;

    INSERT INTO group_standings (
      tournament_id, group_name, participant_id, team_id, played, wins, draws, losses,
      goals_for, goals_against, points, absent, gd_penalty
    ) VALUES (
      v_fixture.tournament_id, COALESCE(v_group_name, 'A'), v_home_participant, v_fixture.home_team_id,
      1,
      CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
      CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
      home_gf, home_ga,
      CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      home_absent_inc, home_gdp_inc
    )
    ON CONFLICT (tournament_id, group_name, participant_id) DO UPDATE SET
      team_id = EXCLUDED.team_id,
      played = group_standings.played + 1,
      wins = group_standings.wins + CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
      draws = group_standings.draws + CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      losses = group_standings.losses + CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
      goals_for = group_standings.goals_for + home_gf,
      goals_against = group_standings.goals_against + home_ga,
      points = group_standings.points + CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      absent = group_standings.absent + home_absent_inc,
      gd_penalty = group_standings.gd_penalty + home_gdp_inc;

    INSERT INTO group_standings (
      tournament_id, group_name, participant_id, team_id, played, wins, draws, losses,
      goals_for, goals_against, points, absent, gd_penalty
    ) VALUES (
      v_fixture.tournament_id, COALESCE(v_group_name, 'A'), v_away_participant, v_fixture.away_team_id,
      1,
      CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
      CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
      away_gf, away_ga,
      CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      away_absent_inc, away_gdp_inc
    )
    ON CONFLICT (tournament_id, group_name, participant_id) DO UPDATE SET
      team_id = EXCLUDED.team_id,
      played = group_standings.played + 1,
      wins = group_standings.wins + CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
      draws = group_standings.draws + CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      losses = group_standings.losses + CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
      goals_for = group_standings.goals_for + away_gf,
      goals_against = group_standings.goals_against + away_ga,
      points = group_standings.points + CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      absent = group_standings.absent + away_absent_inc,
      gd_penalty = group_standings.gd_penalty + away_gdp_inc;

    UPDATE fixtures SET status = 'confirmed' WHERE id = NEW.fixture_id;

    RETURN NEW;
  END IF;

  -- League standings update (slot-keyed)
  SELECT * INTO home_current FROM standings s
  WHERE s.tournament_id = v_fixture.tournament_id AND s.participant_id = v_home_participant;

  SELECT * INTO away_current FROM standings s
  WHERE s.tournament_id = v_fixture.tournament_id AND s.participant_id = v_away_participant;

  v_new_form_home := right(COALESCE(home_current.form, '') || CASE WHEN home_outcome IN ('W','D','L') THEN home_outcome ELSE '' END, 6);
  v_new_form_away := right(COALESCE(away_current.form, '') || CASE WHEN away_outcome IN ('W','D','L') THEN away_outcome ELSE '' END, 6);

  INSERT INTO standings (
    tournament_id, participant_id, team_id, played, wins, draws, losses,
    goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    biggest_win_score, biggest_win_opponent_id, absent, gd_penalty
  ) VALUES (
    v_fixture.tournament_id, v_home_participant, v_fixture.home_team_id,
    1,
    CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
    CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
    home_gf, home_ga,
    CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN home_outcome IN ('W','D','L') THEN home_outcome ELSE '' END,
    CASE WHEN home_outcome IN ('W', 'D') THEN 1 ELSE 0 END,
    CASE WHEN home_ga = 0 AND home_outcome IN ('W','D') THEN 1 ELSE 0 END,
    CASE WHEN home_outcome = 'W' THEN (home_gf::text || '-' || home_ga::text) ELSE NULL END,
    CASE WHEN home_outcome = 'W' THEN v_fixture.away_team_id ELSE NULL END,
    home_absent_inc, home_gdp_inc
  )
  ON CONFLICT (tournament_id, participant_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    played = standings.played + 1,
    wins = standings.wins + CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
    draws = standings.draws + CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    losses = standings.losses + CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
    goals_for = standings.goals_for + home_gf,
    goals_against = standings.goals_against + home_ga,
    points = standings.points + CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    form = CASE WHEN home_outcome IN ('W','D','L') THEN right(COALESCE(standings.form, '') || home_outcome, 6) ELSE standings.form END,
    unbeaten_run = CASE
      WHEN home_outcome IN ('W', 'D') THEN standings.unbeaten_run + 1
      WHEN home_outcome = 'L' THEN 0
      ELSE standings.unbeaten_run
    END,
    clean_sheets = standings.clean_sheets + CASE WHEN home_ga = 0 AND home_outcome IN ('W','D') THEN 1 ELSE 0 END,
    biggest_win_score = CASE
      WHEN home_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (home_gf - home_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN (home_gf::text || '-' || home_ga::text)
      ELSE standings.biggest_win_score
    END,
    biggest_win_opponent_id = CASE
      WHEN home_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (home_gf - home_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN v_fixture.away_team_id
      ELSE standings.biggest_win_opponent_id
    END,
    absent = standings.absent + home_absent_inc,
    gd_penalty = standings.gd_penalty + home_gdp_inc,
    updated_at = now();

  INSERT INTO standings (
    tournament_id, participant_id, team_id, played, wins, draws, losses,
    goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    biggest_win_score, biggest_win_opponent_id, absent, gd_penalty
  ) VALUES (
    v_fixture.tournament_id, v_away_participant, v_fixture.away_team_id,
    1,
    CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
    CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
    away_gf, away_ga,
    CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN away_outcome IN ('W','D','L') THEN away_outcome ELSE '' END,
    CASE WHEN away_outcome IN ('W', 'D') THEN 1 ELSE 0 END,
    CASE WHEN away_ga = 0 AND away_outcome IN ('W','D') THEN 1 ELSE 0 END,
    CASE WHEN away_outcome = 'W' THEN (away_gf::text || '-' || away_ga::text) ELSE NULL END,
    CASE WHEN away_outcome = 'W' THEN v_fixture.home_team_id ELSE NULL END,
    away_absent_inc, away_gdp_inc
  )
  ON CONFLICT (tournament_id, participant_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    played = standings.played + 1,
    wins = standings.wins + CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
    draws = standings.draws + CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    losses = standings.losses + CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
    goals_for = standings.goals_for + away_gf,
    goals_against = standings.goals_against + away_ga,
    points = standings.points + CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    form = CASE WHEN away_outcome IN ('W','D','L') THEN right(COALESCE(standings.form, '') || away_outcome, 6) ELSE standings.form END,
    unbeaten_run = CASE
      WHEN away_outcome IN ('W', 'D') THEN standings.unbeaten_run + 1
      WHEN away_outcome = 'L' THEN 0
      ELSE standings.unbeaten_run
    END,
    clean_sheets = standings.clean_sheets + CASE WHEN away_ga = 0 AND away_outcome IN ('W','D') THEN 1 ELSE 0 END,
    biggest_win_score = CASE
      WHEN away_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (away_gf - away_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN (away_gf::text || '-' || away_ga::text)
      ELSE standings.biggest_win_score
    END,
    biggest_win_opponent_id = CASE
      WHEN away_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (away_gf - away_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN v_fixture.home_team_id
      ELSE standings.biggest_win_opponent_id
    END,
    absent = standings.absent + away_absent_inc,
    gd_penalty = standings.gd_penalty + away_gdp_inc,
    updated_at = now();

  -- abandon_count tracking
  IF NEW.is_abandoned THEN
    IF NEW.abandoned_type IN ('home', 'both') THEN
      UPDATE teams SET abandon_count = abandon_count + 1
      WHERE id = v_fixture.home_team_id;
    END IF;
    IF NEW.abandoned_type IN ('away', 'both') THEN
      UPDATE teams SET abandon_count = abandon_count + 1
      WHERE id = v_fixture.away_team_id;
    END IF;
  END IF;

  UPDATE fixtures SET status = 'confirmed' WHERE id = NEW.fixture_id;

  UPDATE predictions p
  SET points_earned = CASE
    WHEN p.predicted_home_score = NEW.home_score AND p.predicted_away_score = NEW.away_score THEN 3
    WHEN (
      (p.predicted_home_score > p.predicted_away_score AND NEW.home_score > NEW.away_score) OR
      (p.predicted_home_score < p.predicted_away_score AND NEW.home_score < NEW.away_score) OR
      (p.predicted_home_score = p.predicted_away_score AND NEW.home_score = NEW.away_score)
    ) THEN 1
    ELSE 0
  END
  WHERE p.fixture_id = NEW.fixture_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;