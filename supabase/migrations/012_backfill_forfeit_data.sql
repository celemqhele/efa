-- Backfill existing forfeit/absence data into forfeit_balances and standings
-- Run this ONCE after deploying migrations 010 and 011

-- 1a. Create forfeit_balances for existing abandoned results (home or away)
INSERT INTO forfeit_balances (fixture_id, forfeiting_team_id, opponent_team_id, opponent_score, forfeiting_score, half_time_note, remaining)
SELECT
  r.fixture_id,
  CASE
    WHEN r.abandoned_type = 'home' THEN f.home_team_id
    WHEN r.abandoned_type = 'away' THEN f.away_team_id
  END,
  CASE
    WHEN r.abandoned_type = 'home' THEN f.away_team_id
    WHEN r.abandoned_type = 'away' THEN f.home_team_id
  END,
  CASE
    WHEN r.abandoned_type = 'home' THEN r.away_score
    WHEN r.abandoned_type = 'away' THEN r.home_score
  END,
  CASE
    WHEN r.abandoned_type = 'home' THEN r.home_score
    WHEN r.abandoned_type = 'away' THEN r.away_score
  END,
  CONCAT(
    'Forfeit: ',
    (SELECT name FROM teams WHERE id = CASE WHEN r.abandoned_type = 'home' THEN f.home_team_id WHEN r.abandoned_type = 'away' THEN f.away_team_id END),
    ' vs ',
    (SELECT name FROM teams WHERE id = CASE WHEN r.abandoned_type = 'home' THEN f.away_team_id WHEN r.abandoned_type = 'away' THEN f.home_team_id END),
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

-- 1b. Create forfeit_balances for 'both' abandoned — one row per forfeiting team
INSERT INTO forfeit_balances (fixture_id, forfeiting_team_id, opponent_team_id, opponent_score, forfeiting_score, half_time_note, remaining)
SELECT
  r.fixture_id,
  unnest(ARRAY[f.home_team_id, f.away_team_id]) AS forfeiting_team_id,
  unnest(ARRAY[f.away_team_id, f.home_team_id]) AS opponent_team_id,
  unnest(ARRAY[r.away_score, r.home_score]) AS opponent_score,
  unnest(ARRAY[r.home_score, r.away_score]) AS forfeiting_score,
  unnest(ARRAY[
    CONCAT('Forfeit: ', (SELECT name FROM teams WHERE id = f.home_team_id), ' vs ', (SELECT name FROM teams WHERE id = f.away_team_id), ' — ', r.home_score, '-', r.away_score, ' (HT)'),
    CONCAT('Forfeit: ', (SELECT name FROM teams WHERE id = f.away_team_id), ' vs ', (SELECT name FROM teams WHERE id = f.home_team_id), ' — ', r.away_score, '-', r.home_score, ' (HT)')
  ]),
  1
FROM results r
JOIN fixtures f ON f.id = r.fixture_id
WHERE r.is_abandoned = true
  AND r.abandoned_type = 'both'
  AND NOT EXISTS (SELECT 1 FROM forfeit_balances fb WHERE fb.fixture_id = r.fixture_id);

-- 2. Update standings absent count and gd_penalty for abandoned results
UPDATE standings s
SET
  absent = s.absent + sub.absent_count,
  gd_penalty = s.gd_penalty + sub.total_penalty
FROM (
  SELECT
    f.tournament_id,
    v.team_id,
    COUNT(*) AS absent_count,
    COUNT(*) * -3 AS total_penalty
  FROM results r
  JOIN fixtures f ON f.id = r.fixture_id
  CROSS JOIN LATERAL (
    SELECT f.home_team_id AS team_id
    WHERE r.abandoned_type IN ('home', 'both')
    UNION ALL
    SELECT f.away_team_id AS team_id
    WHERE r.abandoned_type IN ('away', 'both')
  ) v
  WHERE r.is_abandoned = true
    AND f.status = 'confirmed'
  GROUP BY f.tournament_id, v.team_id
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
    COALESCE(tp.group_name, tph.group_name) AS group_name,
    v.team_id,
    COUNT(*) AS absent_count,
    COUNT(*) * -3 AS total_penalty
  FROM results r
  JOIN fixtures f ON f.id = r.fixture_id
  LEFT JOIN tournament_participants tp ON tp.tournament_id = f.tournament_id AND tp.team_id = f.home_team_id
  LEFT JOIN tournament_participants tph ON tph.tournament_id = f.tournament_id AND tph.team_id = f.away_team_id
  CROSS JOIN LATERAL (
    SELECT f.home_team_id AS team_id
    WHERE r.abandoned_type IN ('home', 'both')
    UNION ALL
    SELECT f.away_team_id AS team_id
    WHERE r.abandoned_type IN ('away', 'both')
  ) v
  WHERE r.is_abandoned = true
    AND f.status = 'confirmed'
    AND f.round_type = 'group'
  GROUP BY f.tournament_id, COALESCE(tp.group_name, tph.group_name), v.team_id
) sub
WHERE gs.tournament_id = sub.tournament_id AND gs.team_id = sub.team_id AND gs.group_name = sub.group_name;
