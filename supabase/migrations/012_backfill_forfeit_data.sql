-- Backfill existing forfeit/absence data into forfeit_balances and standings
-- Run this ONCE after deploying migrations 010 and 011

-- 1. Create forfeit_balances for existing abandoned results
INSERT INTO forfeit_balances (fixture_id, forfeiting_team_id, opponent_team_id, opponent_score, forfeiting_score, half_time_note, remaining)
SELECT
  r.fixture_id,
  CASE
    WHEN r.abandoned_type = 'home' THEN f.home_team_id
    WHEN r.abandoned_type = 'away' THEN f.away_team_id
    ELSE NULL
  END,
  CASE
    WHEN r.abandoned_type = 'home' THEN f.away_team_id
    WHEN r.abandoned_type = 'away' THEN f.home_team_id
    ELSE NULL
  END,
  CASE
    WHEN r.abandoned_type = 'home' THEN r.away_score
    WHEN r.abandoned_type = 'away' THEN r.home_score
    ELSE 0
  END,
  CASE
    WHEN r.abandoned_type = 'home' THEN r.home_score
    WHEN r.abandoned_type = 'away' THEN r.away_score
    ELSE 0
  END,
  CONCAT(
    'Forfeit: ',
    COALESCE((SELECT name FROM teams WHERE id = CASE WHEN r.abandoned_type = 'home' THEN f.home_team_id WHEN r.abandoned_type = 'away' THEN f.away_team_id END), 'Unknown'),
    ' vs ',
    COALESCE((SELECT name FROM teams WHERE id = CASE WHEN r.abandoned_type = 'home' THEN f.away_team_id WHEN r.abandoned_type = 'away' THEN f.home_team_id END), 'Unknown'),
    ' — ',
    CASE WHEN r.abandoned_type = 'home' THEN r.home_score ELSE r.away_score END,
    '-',
    CASE WHEN r.abandoned_type = 'home' THEN r.away_score ELSE r.home_score END,
    ' (HT)'
  ),
  1
FROM results r
JOIN fixtures f ON f.id = r.fixture_id
WHERE r.is_abandoned = true
  AND r.abandoned_type IN ('home', 'away')
  AND NOT EXISTS (SELECT 1 FROM forfeit_balances fb WHERE fb.fixture_id = r.fixture_id);

-- 2. Update standings absent count and gd_penalty for abandoned results
UPDATE standings s
SET
  absent = s.absent + sub.absent_count,
  gd_penalty = s.gd_penalty + sub.total_penalty
FROM (
  SELECT
    f.tournament_id,
    CASE WHEN r.abandoned_type IN ('home', 'both') THEN f.home_team_id
         WHEN r.abandoned_type = 'away' THEN f.away_team_id END AS team_id,
    COUNT(*) AS absent_count,
    COUNT(*) * -3 AS total_penalty
  FROM results r
  JOIN fixtures f ON f.id = r.fixture_id
  WHERE r.is_abandoned = true
    AND f.status = 'confirmed'
  GROUP BY f.tournament_id,
    CASE WHEN r.abandoned_type IN ('home', 'both') THEN f.home_team_id
         WHEN r.abandoned_type = 'away' THEN f.away_team_id END
) sub
WHERE s.tournament_id = sub.tournament_id AND s.team_id = sub.team_id;

-- 3. Update group_standings similarly
UPDATE group_standings gs
SET
  absent = gs.absent + sub.absent_count,
  gd_penalty = gs.gd_penalty + sub.total_penalty
FROM (
  SELECT
    f.tournament_id,
    tp.group_name,
    CASE WHEN r.abandoned_type IN ('home', 'both') THEN f.home_team_id
         WHEN r.abandoned_type = 'away' THEN f.away_team_id END AS team_id,
    COUNT(*) AS absent_count,
    COUNT(*) * -3 AS total_penalty
  FROM results r
  JOIN fixtures f ON f.id = r.fixture_id
  JOIN tournament_participants tp ON tp.tournament_id = f.tournament_id AND tp.team_id = f.home_team_id
  WHERE r.is_abandoned = true
    AND f.status = 'confirmed'
    AND f.round_type = 'group'
  GROUP BY f.tournament_id, tp.group_name,
    CASE WHEN r.abandoned_type IN ('home', 'both') THEN f.home_team_id
         WHEN r.abandoned_type = 'away' THEN f.away_team_id END
) sub
WHERE gs.tournament_id = sub.tournament_id AND gs.team_id = sub.team_id AND gs.group_name = sub.group_name;
