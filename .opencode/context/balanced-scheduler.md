# Balanced Weekly Fixture Scheduler

## Problem
Unbalanced fixtures with mixed legs (e.g., leg 2 before leg 1) and high fixture density in season 3.

## Fix
- New balanced scheduler in `lib/fixture-slots.ts`:
  - **Weekly pool**: 30 matches/week total tournament-wide (split evenly: each team `floor(60/N)` participations/week).
  - **Daily**: max 5 matches/day tournament-wide, max 1 match/team/day.
  - **Leg Phasing**: strict leg-1 before leg-2 ordering.
- Updated generators (`league`, `groups`, `friendlies`) to pass scheduling options.
- Fixed `exhibition` duplicate-pairings bug (used circle-method round-robin).
- Updated UI estimate in `GenerateFixturesButton.tsx` (30/week).
