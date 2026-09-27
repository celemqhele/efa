-- Assign the clubs chosen in the closed "2026 SA Club Selection" poll (f79b9129)
-- and open a fresh tenure for each manager, for the new season.
--
-- Runs immediately after global_reset_manager_tenures.sql, so every manager
-- currently has no club and no open tenure. Each of these 29 assignments
-- therefore starts a brand new tenure row with zeroed W/D/L/GF/GA.
--
-- "First pick wins": three managers applied for two clubs each. The first is the
-- earliest poll_applications.created_at for that applicant (tie-broken by id):
--   hunger_      Hungry Lions       2026-09-27T12:35:11Z  (2nd: Leruma, ABC)
--   m_a_s_h_a_u  Casric Stars        2026-09-26T15:13:22Z  (2nd: Leicesterford City, MFC)
--   wamashudu    Orbit College       2026-09-27T16:37:24Z  (2nd: Jomo Cosmos, ABC)
-- The unclaimed second picks (Leruma, Jomo Cosmos) stay vacant.
--
-- Club rows are matched to the poll pick on the same pair the rest of the app
-- uses: logo_league_folder = poll team_league, and
-- logo_team_slug = slugified poll team_name. All 29 resolve to exactly one row
-- (verified: no sibling/duplicate club rows exist in these three leagues).
--
-- guards: only un-managed clubs are claimed, and a tenure is only inserted when
-- the manager has no open one, so this is safe to re-run.
--
-- profiles.sacked_at is left untouched. It is a 7-day reassignment cooldown that
-- nothing in the codebase ever clears, and it is not a visibility flag, so 18
-- managers carrying a stale value from earlier in the year is harmless. Run
-- global_reset_sack_cooldown.sql to clear them if a cooldown ever needs lifting.
--
-- abandon_count is left untouched: it is lifetime club history that feeds forfeit
-- logic, and all 29 of these clubs already sit at 0.

WITH ranked AS (
  SELECT pa.applicant_id,
         pa.team_name,
         pa.team_league,
         pa.created_at,
         pa.id AS application_id,
         row_number() OVER (
           PARTITION BY pa.applicant_id
           ORDER BY pa.created_at, pa.id
         ) AS pick_order
  FROM poll_applications pa
  JOIN polls p ON p.id = pa.poll_id
  WHERE p.share_code = 'f79b9129'
),
first_pick AS (
  SELECT applicant_id, team_name, team_league
  FROM ranked
  WHERE pick_order = 1
),
resolved AS (
  SELECT fp.applicant_id,
         t.id AS team_id,
         pr.username
  FROM first_pick fp
  JOIN teams t
    ON t.logo_league_folder = fp.team_league
   AND t.logo_team_slug = lower(regexp_replace(fp.team_name, '[^a-zA-Z0-9]+', '-', 'g'))
  JOIN profiles pr ON pr.id = fp.applicant_id
),
assigned AS (
  UPDATE teams t
  SET manager_id = r.applicant_id
  FROM resolved r
  WHERE t.id = r.team_id
    AND t.manager_id IS NULL
  RETURNING t.id AS team_id, r.applicant_id, r.username
)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at)
SELECT a.team_id, a.applicant_id, a.username, now()
FROM assigned a
WHERE NOT EXISTS (
  SELECT 1 FROM manager_tenures mt
  WHERE mt.manager_id = a.applicant_id AND mt.ended_at IS NULL
)
RETURNING manager_username, team_id, started_at;
