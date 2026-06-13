-- Drop UNIQUE constraint on teams.manager_id to allow:
--   1. A manager to manage multiple teams (multi-team)
--   2. Auto-ending tenures on phase completion without FK conflicts
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_manager_id_key;

-- Also drop any index that enforces uniqueness on manager_id
DROP INDEX IF EXISTS idx_teams_manager_id;
