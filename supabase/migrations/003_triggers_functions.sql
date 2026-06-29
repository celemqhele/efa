-- EFA Platform — Triggers & Functions

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- UPDATE STANDINGS AFTER RESULT INSERT/UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION update_standings_after_result()
RETURNS TRIGGER AS $$
DECLARE
  v_fixture fixtures%ROWTYPE;
  v_tournament_type text;
  v_group_name text;
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
  -- Absent/penalty tracking
  home_absent_inc int := 0;
  away_absent_inc int := 0;
  home_gdp_inc int := 0;
  away_gdp_inc int := 0;
  v_reason text;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE fixtures.id = NEW.fixture_id;
  SELECT type INTO v_tournament_type FROM tournaments WHERE tournaments.id = v_fixture.tournament_id;
  v_reason := COALESCE(NEW.override_reason, '');

  -- Determine outcome, GF/GA, and absent/penalty flags
  IF NEW.is_abandoned THEN
    -- Forfeit (mid-game quit): actual score stands, forfeiting team gets -3GD + absent++
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
      -- Both forfeited
      home_outcome := 'L'; away_outcome := 'L';
      home_gf := 0; home_ga := 0; away_gf := 0; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
      away_absent_inc := 1; away_gdp_inc := -3;
    END IF;
  ELSIF v_reason LIKE '%absent%' THEN
    -- No-show absence: opponent gets 3-0 win, absent team gets -3GD + absent++, no GF/GA
    IF v_reason LIKE '%both%' THEN
      -- Both absent
      home_outcome := 'A'; away_outcome := 'A';
      home_gf := 0; home_ga := 0; away_gf := 0; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
      away_absent_inc := 1; away_gdp_inc := -3;
    ELSIF NEW.home_score = 0 AND NEW.away_score = 3 THEN
      -- Home absent
      home_outcome := 'A'; away_outcome := 'W';
      home_gf := 0; home_ga := 0; away_gf := 3; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
    ELSE
      -- Away absent (score = 3-0)
      home_outcome := 'W'; away_outcome := 'A';
      home_gf := 3; home_ga := 0; away_gf := 0; away_ga := 0;
      away_absent_inc := 1; away_gdp_inc := -3;
    END IF;
  ELSE
    -- Normal result
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

  -- Handle group stage separately
  IF v_fixture.round_type = 'group' THEN
    SELECT group_name INTO v_group_name
    FROM tournament_participants
    WHERE tournament_participants.tournament_id = v_fixture.tournament_id AND tournament_participants.team_id = v_fixture.home_team_id;

    -- Upsert group standings for home team
    INSERT INTO group_standings (
      tournament_id, group_name, team_id, played, wins, draws, losses,
      goals_for, goals_against, points, absent, gd_penalty
    ) VALUES (
      v_fixture.tournament_id, v_group_name, v_fixture.home_team_id,
      1,
      CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
      CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
      home_gf, home_ga,
      CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      home_absent_inc, home_gdp_inc
    )
    ON CONFLICT (tournament_id, group_name, team_id) DO UPDATE SET
      played = group_standings.played + 1,
      wins = group_standings.wins + CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
      draws = group_standings.draws + CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      losses = group_standings.losses + CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
      goals_for = group_standings.goals_for + home_gf,
      goals_against = group_standings.goals_against + home_ga,
      points = group_standings.points + CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      absent = group_standings.absent + home_absent_inc,
      gd_penalty = group_standings.gd_penalty + home_gdp_inc;

    -- Upsert group standings for away team
    INSERT INTO group_standings (
      tournament_id, group_name, team_id, played, wins, draws, losses,
      goals_for, goals_against, points, absent, gd_penalty
    ) VALUES (
      v_fixture.tournament_id, v_group_name, v_fixture.away_team_id,
      1,
      CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
      CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
      away_gf, away_ga,
      CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      away_absent_inc, away_gdp_inc
    )
    ON CONFLICT (tournament_id, group_name, team_id) DO UPDATE SET
      played = group_standings.played + 1,
      wins = group_standings.wins + CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
      draws = group_standings.draws + CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      losses = group_standings.losses + CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
      goals_for = group_standings.goals_for + away_gf,
      goals_against = group_standings.goals_against + away_ga,
      points = group_standings.points + CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      absent = group_standings.absent + away_absent_inc,
      gd_penalty = group_standings.gd_penalty + away_gdp_inc;

    RETURN NEW;
  END IF;

  -- League standings update
  -- Get current home standings
  SELECT * INTO home_current FROM standings s
  WHERE s.tournament_id = v_fixture.tournament_id AND s.team_id = v_fixture.home_team_id;

  -- Get current away standings
  SELECT * INTO away_current FROM standings s
  WHERE s.tournament_id = v_fixture.tournament_id AND s.team_id = v_fixture.away_team_id;

  -- Calculate new form strings (last 6)
  v_new_form_home := right(COALESCE(home_current.form, '') || CASE WHEN home_outcome IN ('W','D','L') THEN home_outcome ELSE '' END, 6);
  v_new_form_away := right(COALESCE(away_current.form, '') || CASE WHEN away_outcome IN ('W','D','L') THEN away_outcome ELSE '' END, 6);

  -- Upsert home standings
  INSERT INTO standings (
    tournament_id, team_id, played, wins, draws, losses,
    goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    biggest_win_score, biggest_win_opponent_id, absent, gd_penalty
  ) VALUES (
    v_fixture.tournament_id, v_fixture.home_team_id,
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
  ON CONFLICT (tournament_id, team_id) DO UPDATE SET
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

  -- Upsert away standings
  INSERT INTO standings (
    tournament_id, team_id, played, wins, draws, losses,
    goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    biggest_win_score, biggest_win_opponent_id, absent, gd_penalty
  ) VALUES (
    v_fixture.tournament_id, v_fixture.away_team_id,
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
  ON CONFLICT (tournament_id, team_id) DO UPDATE SET
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

  -- Update abandon_count on teams if applicable
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

  -- Update fixture status
  UPDATE fixtures SET status = 'confirmed' WHERE id = NEW.fixture_id;

  -- Score predictions after result
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

DROP TRIGGER IF EXISTS on_result_insert ON results;
CREATE TRIGGER on_result_insert
  AFTER INSERT OR UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION update_standings_after_result();

-- ============================================================
-- AUTO-CHECK RESULT CONFIRMATIONS
-- ============================================================
CREATE OR REPLACE FUNCTION check_result_confirmations()
RETURNS TRIGGER AS $$
DECLARE
  home_conf result_confirmations%ROWTYPE;
  away_conf result_confirmations%ROWTYPE;
  v_fixture fixtures%ROWTYPE;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE id = NEW.fixture_id;

  -- Get both confirmations
  SELECT rc.* INTO home_conf FROM result_confirmations rc
  JOIN teams t ON t.manager_id = rc.submitted_by
  WHERE rc.fixture_id = NEW.fixture_id AND t.id = v_fixture.home_team_id
  ORDER BY rc.confirmed_at DESC LIMIT 1;

  SELECT rc.* INTO away_conf FROM result_confirmations rc
  JOIN teams t ON t.manager_id = rc.submitted_by
  WHERE rc.fixture_id = NEW.fixture_id AND t.id = v_fixture.away_team_id
  ORDER BY rc.confirmed_at DESC LIMIT 1;

  IF home_conf.id IS NOT NULL AND away_conf.id IS NOT NULL THEN
    IF home_conf.home_score = away_conf.home_score AND home_conf.away_score = away_conf.away_score THEN
      UPDATE fixtures SET status = 'awaiting_confirmation' WHERE id = NEW.fixture_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_confirmation_insert ON result_confirmations;
CREATE TRIGGER on_confirmation_insert
  AFTER INSERT ON result_confirmations
  FOR EACH ROW EXECUTE FUNCTION check_result_confirmations();
