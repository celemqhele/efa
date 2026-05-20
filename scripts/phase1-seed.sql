-- ============================================================
-- EFA Phase 1 Seed Data
-- Generated from 38 rounds of match results
-- Run in Supabase SQL Editor
-- NOTE: adjust team names below if they differ from your teams table
-- ============================================================

-- 1. Create Phase 1 season
INSERT INTO seasons (id, name, base_league, status, start_date, end_date)
VALUES (
  'ec04a492-cb9a-4ef2-b49a-2cd686d3be78',
  'EFA Phase 1',
  'Premier League',
  'completed',
  '2024-09-01',
  '2025-06-30'
);

-- 2. Create Phase 1 tournament
INSERT INTO tournaments (id, season_id, name, type, status)
VALUES (
  '118ead40-92c2-4898-8186-aecacc9da1db',
  'ec04a492-cb9a-4ef2-b49a-2cd686d3be78',
  'Phase 1 League',
  'league',
  'completed'
);

-- 3. Insert standings (looked up by team name)
-- If a team name doesn't match your teams table exactly, edit it below.

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  24, 23, 0, 1, 98, 25, 69
FROM teams WHERE name = 'Aston Villa'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Aston Villa: P24 W23 D0 L1 GF98 GA25 GD+73 Pts69

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  28, 22, 1, 5, 89, 44, 67
FROM teams WHERE name = 'Liverpool'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Liverpool: P28 W22 D1 L5 GF89 GA44 GD+45 Pts67

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  24, 20, 0, 4, 76, 35, 60
FROM teams WHERE name = 'Burnley'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Burnley: P24 W20 D0 L4 GF76 GA35 GD+41 Pts60

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  22, 19, 1, 2, 81, 32, 58
FROM teams WHERE name = 'Newcastle United'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Newcastle United: P22 W19 D1 L2 GF81 GA32 GD+49 Pts58

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  24, 14, 2, 8, 79, 46, 44
FROM teams WHERE name = 'Arsenal'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Arsenal: P24 W14 D2 L8 GF79 GA46 GD+33 Pts44

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  24, 14, 1, 9, 54, 42, 43
FROM teams WHERE name = 'Leeds United'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Leeds United: P24 W14 D1 L9 GF54 GA42 GD+12 Pts43

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  21, 13, 0, 8, 69, 39, 39
FROM teams WHERE name = 'Nottingham Forest'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Nottingham Forest: P21 W13 D0 L8 GF69 GA39 GD+30 Pts39

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  21, 12, 2, 7, 65, 44, 38
FROM teams WHERE name = 'Manchester City'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Manchester City: P21 W12 D2 L7 GF65 GA44 GD+21 Pts38

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  22, 6, 1, 15, 26, 62, 19
FROM teams WHERE name = 'Manchester United'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Manchester United: P22 W6 D1 L15 GF26 GA62 GD-36 Pts19

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  15, 2, 2, 11, 21, 51, 8
FROM teams WHERE name = 'Wolverhampton Wanderers'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Wolverhampton Wanderers: P15 W2 D2 L11 GF21 GA51 GD-30 Pts8

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  4, 2, 1, 1, 8, 7, 7
FROM teams WHERE name = 'Bournemouth'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Bournemouth: P4 W2 D1 L1 GF8 GA7 GD+1 Pts7

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  11, 1, 2, 8, 15, 28, 5
FROM teams WHERE name = 'Chelsea'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Chelsea: P11 W1 D2 L8 GF15 GA28 GD-13 Pts5

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  10, 1, 0, 9, 4, 36, 3
FROM teams WHERE name = 'Brighton & Hove Albion'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Brighton & Hove Albion: P10 W1 D0 L9 GF4 GA36 GD-32 Pts3

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  12, 0, 1, 11, 3, 42, 1
FROM teams WHERE name = 'Brentford'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Brentford: P12 W0 D1 L11 GF3 GA42 GD-39 Pts1

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  6, 0, 0, 6, 0, 17, 0
FROM teams WHERE name = 'West Ham United'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- West Ham United: P6 W0 D0 L6 GF0 GA17 GD-17 Pts0

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  6, 0, 0, 6, 0, 17, 0
FROM teams WHERE name = 'Crystal Palace'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Crystal Palace: P6 W0 D0 L6 GF0 GA17 GD-17 Pts0

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  10, 0, 0, 10, 1, 28, 0
FROM teams WHERE name = 'Everton'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Everton: P10 W0 D0 L10 GF1 GA28 GD-27 Pts0

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  8, 0, 0, 8, 0, 28, 0
FROM teams WHERE name = 'Sunderland'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Sunderland: P8 W0 D0 L8 GF0 GA28 GD-28 Pts0

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  8, 0, 0, 8, 0, 30, 0
FROM teams WHERE name = 'Fulham'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Fulham: P8 W0 D0 L8 GF0 GA30 GD-30 Pts0

INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '118ead40-92c2-4898-8186-aecacc9da1db',
  id,
  12, 0, 0, 12, 10, 46, 0
FROM teams WHERE name = 'Tottenham Hotspur'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- Tottenham Hotspur: P12 W0 D0 L12 GF10 GA46 GD-36 Pts0

-- ============================================================
-- Verify: check how many standings rows were inserted
-- SELECT t.name, s.played, s.wins, s.draws, s.losses, s.goals_for, s.goals_against, s.points
-- FROM standings s JOIN teams t ON t.id = s.team_id
-- WHERE s.tournament_id = '118ead40-92c2-4898-8186-aecacc9da1db'
-- ORDER BY s.points DESC;
-- ============================================================
