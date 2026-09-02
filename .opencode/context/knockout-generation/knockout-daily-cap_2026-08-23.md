# Knockout scheduling ignores 5-matches-per-day cap

Date: 2026-08-23
Chain: `knockout-generation/` (follow-up to `knockout-autogen-removal_2026-08-23.md`)

## What happened

After removing the auto-generation bug earlier today, the admin regenerated UEL knockouts
manually with "2 Legs" and noticed the KO fixtures were crammed onto single days
(e.g. all 8 UCL QFs on one day, UEL squeezing 7 QFs onto the same day). He asked whether
the **5 matches per day** cap that applies to league/group/friendly generation also applies
to knockout generation. Suspicion confirmed: it did not.

### Evidence from DB (before fix)

- UCL: 8 QF on one day, 4 SF next day, final alone.
- UEL: 7 QF same day as UCL's QFs, 1 QF spilled to the next day, then SF/final.

The spill was only caused by the *platform-wide* global daily capacity filling up, not any
per-tournament per-day limit.

## Root cause: two separate fixture schedulers

| Scheduler | Used by | Daily cap |
|---|---|---|
| `assignFixtureSlots` (`lib/fixture-slots.ts`) | league / group / friendlies generation | `dailyMatchCap = 5` per run/day + weekly pool of 30 |
| `assignKnockoutDates` (`lib/tournament-progression.ts`) | `generateTBCKnockouts` only | none — only global capacity (30 weekday / 60 weekend-holiday, counted as 2 per fixture via `getSlotStateForDate`) and teamCap 3/day |

Knockout dates are staggered by round relative to base start date (= last group fixture date +1,
or today if later): `ROUND_STAGE_OFFSET { r16: 0, qf: 1, sf: 2, final: 3 }`. Each fixture scans
forward day-by-day until capacity allows.

Also note: single-leg finals are intentional — both the 16-team and 8-team branches always create
exactly one `final` fixture (matchday 301) even when `numLegs === 2`
(`lib/tournament-progression.ts`, see "Final" pushes; matches disconnect rule wording
"single-leg knockout finals only" in `lib/disconnect-rules.ts`). Verified identical shape for
UCL and UEL: QF 4+4 legs, SF 2+2 legs, final 1×leg1.

## Fix (commit 2419847)

Added `KO_DAILY_CAP = 5` and a per-run day counter in `assignKnockoutDates`
(`lib/tournament-progression.ts:158`):

- Before checking slot state for a date, skip it if this run already assigned 5 fixtures there.
- On assignment, increment the counter.

Only affects future generations — existing announced UCL/UEL KO fixtures were left untouched on
purpose (admin had already announced them to the community).

## Learnings / gotchas

- Never assume a constraint applies platform-wide: the 5/day cap lived only inside the batch
  generator, not in KO date assignment.
- `getSlotStateForDate(db, dateStr)` without `tournamentId` counts ALL fixtures platform-wide
  for that date (each fixture adds 2 to `globalUsed`), so cross-tournament pressure can still
  push KOs past their preferred round day.
- Slot semantics recap (for future questions): generation-time defaults are 30 matches/week,
  5/day, 1 match per team per day; reschedule/KO checks use `getDailyCapacity`
  (30 weekday / 60 weekend-holiday global, teamCap 3).

## Related files

- Regeneration crammed dates after the auto-gen removal:
  `.opencode/context/knockout-generation/knockout-autogen-removal_2026-08-23.md`.
- The 5/day cap contrasts with the batch scheduler's balanced distribution:
  `.opencode/context/fixture-scheduling/balanced-scheduler_2026-08-13.md`.
- Next step in the chain — brackets still didn't advance on non-finalise paths:
  `.opencode/context/knockout-generation/knockout-webhook-progression_2026-08-23.md`.
