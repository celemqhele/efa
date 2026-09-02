# Forfeit balances: team-based → manager-based migration (25 Aug)

## Problem
Forfeits were linked to `teams(id)` via `forfeiting_team_id`. When a manager
forfeited a game, then resigned/was sacked, the next manager inherited the
forfeit debt — unfair punishment for someone who didn't commit the offence.

## Solution
Changed `forfeit_balances` to track `forfeiting_manager_id` (UUID → `profiles`)
instead of `forfeiting_team_id`. Forfeits now follow the manager, not the club.

## Migration (`061_forfeit_balances_to_manager.sql`)
1. Added `forfeiting_manager_id UUID REFERENCES profiles(id)` (initially nullable)
2. Backfilled from `teams.manager_id` for each forfeiting team
3. Fallback for managerless teams: used most recent `manager_tenures` row
4. Made `NOT NULL`, dropped `forfeiting_team_id` column

**12 forfeit balances** had teams with no current manager; all were resolved via
historical tenures. 4 of those had `remaining = 1` (active).

## Code Changes

### API Routes
- **`app/api/admin/forfeit-balances/route.ts`** (GET): Changed query param from
  `teamIds` to `managerIds`; queries `.in('forfeiting_manager_id', managerIds)`
  and joins `profiles` for the manager username.
- **`app/api/admin/finalise-result/route.ts`**: 
  - Creation: inserts `forfeiting_manager_id` from `homeTeam.manager_id` /
    `awayTeam.manager_id` (with null guard)
  - Consumption: validates used balances by checking `forfeiting_manager_id`
    against fixture managers (instead of team pair match)
- **`app/api/webhook/route.ts`** `writeResultToDb`:
  - Fixture query now includes `manager_id` on both teams
  - Balance lookup queries by `forfeiting_manager_id` (both fixture managers)
  - Forfeit confirm inserts `forfeiting_manager_id` instead of `forfeiting_team_id`

### Frontend
- **`components/ui/ForfeitBalanceBadge.tsx`**: Props changed from `teamId` to
  `managerId`; filters by `forfeiting_manager_id`
- **`app/(admin)/admin/results/submit/ResultSubmitClient.tsx`**:
  - `Team` interface gains `manager_id` field
  - Fetch uses `managerIds` instead of `teamIds`
  - `handleUseForfeitBalance` determines home/away from `opponent_team_id` vs
    fixture's `away_team.id` (instead of `forfeiting_team_id`)
  - Badge components pass `managerId` prop
- **`app/(admin)/admin/results/submit/page.tsx`**: Fixture query now selects
  `manager_id` on both team relations

## Key Design Decisions
- `opponent_team_id` is **kept as a team reference** (not manager) — it records
  which team was the opponent when the forfeit happened, needed for score
  direction when applying the balance
- Balances where the forfeiting team had no current manager AND no historical
  tenure would have been orphaned (debt dies with the old manager). In practice
  all 12 such cases had tenure history.
- `forfeiting_team_id` column is fully dropped — all display text now uses the
  `half_time_note` field which already contains human-readable team names.

## Notes
- `npx tsc --noEmit` passes (only pre-existing errors in unrelated file)
- `npm run lint` passes (only pre-existing warnings)

## Related files
- Parallel half (same team→manager migration effort) of `.opencode/context/onboarding/manager-data-transfer_2026-08-25.md` (migration 062, trophies → manager-based, plus the transfer feature).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| (none) | All changes were edits to existing files | N/A |
