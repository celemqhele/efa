-- Migrate forfeit_balances from team-based to manager-based.
-- Forfeits now follow the manager, not the club.
-- This prevents a new manager from inheriting a previous manager's forfeit debt.

-- 1. Add forfeiting_manager_id column (nullable initially for backfill)
ALTER TABLE public.forfeit_balances
  ADD COLUMN forfeiting_manager_id UUID REFERENCES public.profiles(id);

-- 2. Backfill: assign each forfeit balance to the current manager of the forfeiting team
--    Active balances (remaining > 0) get priority; consumed ones too if possible.
UPDATE forfeit_balances fb
SET forfeiting_manager_id = t.manager_id
FROM teams t
WHERE fb.forfeiting_team_id = t.id
  AND t.manager_id IS NOT NULL;

-- 3. For balances where the forfeiting team has no current manager,
--    try to find the manager from the most recent tenure for that team.
UPDATE forfeit_balances fb
SET forfeiting_manager_id = mt.manager_id
FROM manager_tenures mt
WHERE fb.forfeiting_manager_id IS NULL
  AND fb.forfeiting_team_id = mt.team_id
  AND mt.ended_at IS NOT NULL
  AND mt.id = (
    SELECT mt2.id FROM manager_tenures mt2
    WHERE mt2.team_id = fb.forfeiting_team_id
    ORDER BY mt2.ended_at DESC
    LIMIT 1
  );

-- 4. Make NOT NULL after backfill
ALTER TABLE public.forfeit_balances
  ALTER COLUMN forfeiting_manager_id SET NOT NULL;

-- 5. Drop the old team-based column
ALTER TABLE public.forfeit_balances
  DROP COLUMN forfeiting_team_id;
