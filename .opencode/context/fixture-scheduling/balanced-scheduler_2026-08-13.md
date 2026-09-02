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

## Related files
- Chain root; the rescheduling this caused led to the truncation fixed in
  `.opencode/context/admin-results/submit-page-truncation-fix_2026-08-14.md`.
- The 5 matches/day tournament-wide cap contrasts with the knockout daily cap in
  `.opencode/context/knockout-generation/knockout-daily-cap_2026-08-23.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |

