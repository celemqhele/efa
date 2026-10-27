# Fixture scheduling: season calendar + 2-leg alternation + venue run limit

This change rebuilt the league fixture generator to use a proper round-robin with circle method, seeded-annealing venue orientation for leg 1, and a strict leg-2 mirror in reversed round order so home/away alternates realistically. Leagues now run on a shared season calendar where every day is either a league day or a cup day (no overlap), `matchday` is the round number per tournament, and `assignFixtureSlots` now breaks at the current leg so leg 2 cannot be placed before leg 1 finishes.

## Problem
- Previous generator produced unrealistic home/away runs (could hit long same-venue streaks) and `matchday` was not resetting cleanly per tournament/round structure.
- Seasons had no calendar; cups and leagues could be scheduled in conflicting ways and the league schedule wasn't aligned to break windows. The old `assignFixtureSlots` could jump ahead past the current leg and place leg-2 fixtures before leg 1 finished.

## Fix
- Added `lib/season-calendar.ts` with presets (`compact`/`standard`/`full`), `buildSeasonCalendar`, `inferCalendarKey`, `readSeasonCalendar`, `calendarDaysFor`. Full preset gives 49 days for 30 rounds (30 league days + 19 cup days) with no day owned twice.
- Rewrote `lib/fixture-generator.ts`: `circleRounds` (circle method), `orientLegOne` (seeded annealing, incremental cost, drives max same-venue run to <= 2), `buildLeagueRounds` (blocks of leg1+leg2 with matchday = round number), `buildGroupRounds`, `placeOnAllowedDays` for packing cups into window days. `generateLeagueFixtures` uses `opts.roundDates` from season calendar; `generateGroupFixtures` uses `opts.allowedDates` and merges rounds across groups.
- Fixed `lib/fixture-slots.ts`: `SlotOptions` now takes `roundDates`/`allowedDates`; `assignFixtureSlots` breaks when `fx.leg > leadLeg` so leg order is enforced.
- Wired calendar into `app/api/admin/start-phase/route.ts` (build calendar from max division rounds, write `seasons.settings.calendar`, store `round_dates`/`season_preset` on league tournaments, pass `roundDates` to generator), `app/api/admin/create-tournament/route.ts` (infer/attach `calendar_key` and `calendar_days`), `app/api/admin/generate-fixtures/route.ts` (pass `slotOpts` to league/group generators), `lib/tournament-progression.ts` `assignKnockoutDates` now walks a calendar-window cursor first (falls back to day scan), `app/api/admin/start-tournament/route.ts` shifts to calendar window days.
- Added `seasons.settings jsonb` via migration `supabase/migrations/108_seasons_settings.sql` (applied) and updated `lib/supabase/types.ts`.
- Added `components/ui/DashboardFixtureActions.tsx` reminder split by side: home instructed to create the matchroom, away instructed to request the match code (last line per side).
- Added preset picker to `app/(admin)/admin/seasons/SeasonManager.tsx` (compact/standard/full) posting to `start-phase`.
- Verified with `npx tsx scripts/dry-run-schedule.ts` (22/22). `npx tsc --noEmit` clean.

## Files
- `lib/season-calendar.ts` (new)
- `lib/fixture-generator.ts` (rewritten)
- `lib/fixture-slots.ts` (modified)
- `supabase/migrations/108_seasons_settings.sql` (new, applied)
- `lib/supabase/types.ts` (modified)
- `app/api/admin/start-phase/route.ts` (modified)
- `app/api/admin/create-tournament/route.ts` (modified)
- `app/api/admin/generate-fixtures/route.ts` (modified)
- `lib/tournament-progression.ts` (modified)
- `app/api/admin/start-tournament/route.ts` (modified)
- `components/ui/DashboardFixtureActions.tsx` (modified)
- `app/(admin)/admin/seasons/SeasonManager.tsx` (modified)
- `scripts/dry-run-schedule.ts` (modified)
