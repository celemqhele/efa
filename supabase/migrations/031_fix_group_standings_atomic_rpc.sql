-- Fix group_standings constraint and RPC function
--
-- The database had two unique constraints on group_standings:
--   1. (tournament_id, group_name, team_id) — correct, from migration 001
--   2. (tournament_id, team_id) — BOGUS, added out-of-band as
--      "group_standings_tournament_team_unique"
--
-- The second constraint conflicts with the first: a team can only have
-- ONE row per tournament regardless of group, which breaks group-stage
-- standings when a team plays in only one group (the INSERT with ON CONFLICT
-- on the 3-column constraint still violates the 2-column constraint).
--
-- Also fixes update_group_standings_atomic which was missing group_name
-- and used ON CONFLICT (tournament_id, team_id) against the bogus constraint.

-- Drop the bogus constraint
ALTER TABLE group_standings
  DROP CONSTRAINT IF EXISTS group_standings_tournament_team_unique;

-- Recreate the RPC with proper group_name support
CREATE OR REPLACE FUNCTION update_group_standings_atomic(
  p_tournament_id uuid,
  p_team_id uuid,
  p_group_name text,
  p_played_inc int,
  p_wins_inc int,
  p_draws_inc int,
  p_losses_inc int,
  p_gf_inc int,
  p_ga_inc int,
  p_points_inc int,
  p_absent_inc int DEFAULT 0,
  p_gd_penalty_inc int DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO group_standings (
    tournament_id, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, points,
    absent, gd_penalty
  ) VALUES (
    p_tournament_id, p_group_name, p_team_id, p_played_inc, p_wins_inc, p_draws_inc, p_losses_inc, p_gf_inc, p_ga_inc, p_points_inc,
    p_absent_inc, p_gd_penalty_inc
  )
  ON CONFLICT (tournament_id, group_name, team_id) DO UPDATE SET
    played = group_standings.played + p_played_inc,
    wins = group_standings.wins + p_wins_inc,
    draws = group_standings.draws + p_draws_inc,
    losses = group_standings.losses + p_losses_inc,
    goals_for = group_standings.goals_for + p_gf_inc,
    goals_against = group_standings.goals_against + p_ga_inc,
    points = group_standings.points + p_points_inc,
    absent = group_standings.absent + p_absent_inc,
    gd_penalty = group_standings.gd_penalty + p_gd_penalty_inc,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
