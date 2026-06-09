-- RPC function to atomically update league standings
CREATE OR REPLACE FUNCTION update_standings_atomic(
  p_tournament_id uuid,
  p_team_id uuid,
  p_played_inc int,
  p_wins_inc int,
  p_draws_inc int,
  p_losses_inc int,
  p_gf_inc int,
  p_ga_inc int,
  p_points_inc int,
  p_form_char text,
  p_unbeaten_run_reset boolean,
  p_clean_sheet_inc int
)
RETURNS void AS $$
BEGIN
  INSERT INTO standings (
    tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points, form, unbeaten_run, clean_sheets
  ) VALUES (
    p_tournament_id, p_team_id, p_played_inc, p_wins_inc, p_draws_inc, p_losses_inc, p_gf_inc, p_ga_inc, p_points_inc, p_form_char, 
    CASE WHEN p_unbeaten_run_reset THEN 0 ELSE p_wins_inc + p_draws_inc END, p_clean_sheet_inc
  )
  ON CONFLICT (tournament_id, team_id) DO UPDATE SET
    played = standings.played + p_played_inc,
    wins = standings.wins + p_wins_inc,
    draws = standings.draws + p_draws_inc,
    losses = standings.losses + p_losses_inc,
    goals_for = standings.goals_for + p_gf_inc,
    goals_against = standings.goals_against + p_ga_inc,
    points = standings.points + p_points_inc,
    form = right(standings.form || p_form_char, 5),
    unbeaten_run = CASE WHEN p_unbeaten_run_reset THEN 0 ELSE standings.unbeaten_run + p_played_inc END,
    clean_sheets = standings.clean_sheets + p_clean_sheet_inc,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function for group standings
CREATE OR REPLACE FUNCTION update_group_standings_atomic(
  p_tournament_id uuid,
  p_team_id uuid,
  p_played_inc int,
  p_wins_inc int,
  p_draws_inc int,
  p_losses_inc int,
  p_gf_inc int,
  p_ga_inc int,
  p_points_inc int
)
RETURNS void AS $$
BEGIN
  INSERT INTO group_standings (
    tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points
  ) VALUES (
    p_tournament_id, p_team_id, p_played_inc, p_wins_inc, p_draws_inc, p_losses_inc, p_gf_inc, p_ga_inc, p_points_inc
  )
  ON CONFLICT (tournament_id, team_id) DO UPDATE SET
    played = group_standings.played + p_played_inc,
    wins = group_standings.wins + p_wins_inc,
    draws = group_standings.draws + p_draws_inc,
    losses = group_standings.losses + p_losses_inc,
    goals_for = group_standings.goals_for + p_gf_inc,
    goals_against = group_standings.goals_against + p_ga_inc,
    points = group_standings.points + p_points_inc,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
