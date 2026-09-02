# Matchday slots raised from 5 to 8 per day (weekly pool 30 → 56)

**Date:** 2026-09-02

Raised the per-tournament daily matchday cap from 5 to 8 (and the weekly match pool from 30 to 56) across both fixture schedulers, centralizing the numbers in `lib/fixture-slots.ts`. The admin reported 5 matchday slots per day was too low — e.g. an 8-fixture knockout round (UCL QFs) couldn't land on one day, capping at 5 and spilling to the next. This follows the chain in `.opencode/context/fixture-scheduling/balanced-scheduler_2026-08-13.md` (where 5/day + 30/week were introduced) and `.opencode/context/knockout-generation/knockout-daily-cap_2026-08-23.md` (where the parallel KO `KO_DAILY_CAP = 5` was added).

## Problem
- Two hardcoded "5/day" caps: `lib/fixture-slots.ts` batch-generator default (`(opts?.dailyMatchCap ?? 5)`) and `lib/tournament-progression.ts` `KO_DAILY_CAP = 5` — historically set in lock-step but as separate literals.
- A 30/week pool (`weeklyMatches`) bound harder than the 5/day cap in the batch scheduler (30 fixtures over 7 days ≈ 4.3/day), so raising the daily cap alone would barely compress league/group schedules.
- Knockouts have **no** weekly pool, so `KO_DAILY_CAP` was the real binding constraint there (UCL 8 QFs → 5 on day 1, 3 spill to day 2).

## Fix
1. **`lib/fixture-slots.ts`** — added `export const WEEKLY_MATCHES = 56` and `export const DAILY_MATCH_CAP = 8`; `assignFixtureSlots` defaults now read `opts?.weeklyMatches ?? WEEKLY_MATCHES` and `(opts?.dailyMatchCap ?? DAILY_MATCH_CAP) - reservedSlots`. `SlotOptions` doc comments updated.
2. **`lib/tournament-progression.ts`** — `KO_DAILY_CAP` now = imported `DAILY_MATCH_CAP` (single source of truth, prevents the two caps drifting apart again).
3. **`app/(admin)/admin/tournaments/GenerateFixturesButton.tsx`** — `MATCHES_PER_WEEK` estimate 30 → 56 (drives the end-date estimate in the generate dialog).
4. **`app/api/admin/schedule-fixtures/route.ts`** — `CUP_WEEKLY_SLOT_BUDGET` 30 → 56 (manual weekly-window budget for cup rescheduling).

## Key details
- `opts` overrides still win — callers passing explicit `weeklyMatches`/`dailyMatchCap` keep their values.
- Net scheduling effect: 20-team league (380 fixtures) now needs ~7 windows vs ~13; an 8-match KO round fits on one day.
- **Unchanged on purpose:** platform-wide safety net `getDailyCapacity` (global 30 weekday / 60 weekend, team cap 3/day) — it is ≥ 8/day per-tournament so never the bind, and admin confirmed to leave it. Also unchanged: 1 match per team per day in batch generation.
- `lib/phase-fixture-generator.ts` is dead code (imported nowhere) and was left untouched.

## Related files
- Introduced 5/day + 30/week: `.opencode/context/fixture-scheduling/balanced-scheduler_2026-08-13.md`.
- Original KO cap gap + parallel fix: `.opencode/context/knockout-generation/knockout-daily-cap_2026-08-23.md`.

## Verification
- `npx tsc --noEmit` passes; `npm run lint` clean for the four touched files (repo-wide warnings pre-existing and unrelated).