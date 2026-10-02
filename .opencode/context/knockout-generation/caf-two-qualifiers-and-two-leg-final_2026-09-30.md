# CAF: two qualifiers per group and a two-legged final

Raised the CAF Champions League and CAF Confederations League from one qualifier per group to two, which moves both cups onto the eight-team knockout branch (QF → SF → Final) instead of skipping straight to the semi-finals, and added two-legged final support so the CAF finals are played over two legs. While verifying the change I found that `service_role` had lost all Data API grants on 15 legacy tables, which had been silently breaking trophy awards since Sept; both are fixed here.

## Problem

### 1. Only four teams reached the CAF knockouts
Season 4 launched both CAF cups with `settings.qualifiers_per_group = 1` across `num_groups = 4`. `generateTBCKnockouts()` in `lib/tournament-progression.ts` branches on the qualifier count:

- `teamCount === 8` → QF `101-104`, SF `201-202`, Final `301`
- `teamCount === 4` → SF `201-202`, Final `301`

So with 4 qualifiers both CAF cups would have generated a bracket with no quarter-finals at all.

### 2. Every final was single-legged
`isTwoLeg` (`num_legs === 2`) only added leg 2 for the QF and SF bands. The final was always a single fixture at matchday `301`, and `BRACKET_PROGRESSION` has no entry for `301`/`311` because there is nothing left to advance into — so `advanceWinner()` hit its "no progression" branch and called `awardTrophy()` off whichever final leg arrived first. CAF's continental finals are two-legged, so the trophy would have been handed out on leg 1.

### 3. `assignKnockoutDates()` let rounds collapse onto one date
The scheduler applied a nominal day offset per round (`ROUND_STAGE_OFFSET`), then walked forward day by day when a date hit `KO_DAILY_CAP`. Because the search started from each round's *own* nominal date rather than from the previous round's result, an over-capacity round overflowed and its successors — still anchored to their own nominal dates — caught up and landed on the same day. The Nedbank Cup (`ab37be7d-9882-463a-8011-620af9417ce1`) was the live symptom: R16 on `2026-11-03`, then QF, SF **and** Final all on `2026-11-04`.

### 4. service_role had no Data API grants on 15 legacy tables (found while verifying)
`awardTrophy()` inserts into `trophies` without checking the error. A verification run showed `permission denied for table trophies` and no trophy row. Migration `076_data_api_default_privileges.sql` only restores grants for **future** tables, so the 15 tables that predate it were left behind by the Oct 30, 2026 Supabase change:

`channel_messages`, `channels`, `comments`, `conversations`, `knockout_rounds`, `manager_pins`, `messages`, `predictions`, `reactions`, `search_profiles`, `season_breaks`, `team_aliases`, `team_name_mappings`, `trophies`, `waiting_reports`

`service_role` held only `TRUNCATE`/`REFERENCES`/`TRIGGER` on each. The latest `trophies` row is dated `2026-09-25`, i.e. no trophy had been awarded through the admin client since the grant change, while the tournament was still being marked `completed`.

## Fix

### CAF settings — `supabase/migrations/086_caf_two_qualifiers_two_leg_final.sql`
Sets `qualifiers_per_group = 2` and `num_legs = 2` on the CAF Champions League (`a38a882b-04c7-4264-a1c8-9e84ee1cecf4`) and CAF Confederations League (`81f77443-f442-4a5f-b7b8-6fabac3f92d8`), guarded on `num_groups = 4` so it can only hit the intended competitions. No CAF knockout fixtures exist yet, so the bracket is generated on demand from the admin Generate Knockouts action and nothing needed deleting.

### Two-legged final
- `lib/tournament-progression.ts`: the `teamCount === 8` and `teamCount === 4` branches now also emit final leg 2 at matchday `311` when `isTwoLeg`. Added `LEG_GAP_DAYS = 1` so leg 2 can never share a date with leg 1.
- `advanceWinner()`'s `round_type === 'final'` branch now looks for a sibling final leg (`matchday ± 10`, `round_type = 'final'`). Leg 1 returns early and waits; leg 2 resolves the tie with `determineAggregateWinner()` (aggregate → penalties on leg 2 → leg 2 result), falling back to `resolveTournamentGdLeader()` only on a fully level tie, then passes the winner explicitly to `awardTrophy()`.
- `awardTrophy()` gained an optional `forcedWinnerId`. A two-legged tie is scored off the aggregate, so leg 2's own score says nothing about who lifted the trophy; the forced winner short-circuits the home/away comparison. Single-leg finals are unchanged.
- `NEXT_ROUND_LEG1_MDS` gained `301` so `mirrorLeg2Teams()` populates final leg 2's home/away.
- `lib/aggregate.ts`: `KO_LEG1_MATCHDAYS` / `KO_LEG2_MATCHDAYS` (extracted from the four hardcoded arrays) now include `301`/`311`, and `isTwoLegKnockout()` accepts `final`.

### Knockout date chronology
`assignKnockoutDates()` now tracks a `floorDate` (furthest date used so far) and a `lastKey` of `round_type:leg`. Fixtures sharing a key may share a day; crossing to a new key advances the floor by one day, so no round can be scheduled on or before the round that feeds it.

### Silent trophy failures
`awardTrophy()` now logs and returns on a failed `trophies` insert instead of marking the tournament `completed` with no winner recorded.

### service_role grants — `supabase/migrations/087_service_role_legacy_grants.sql`
`GRANT SELECT, INSERT, UPDATE, DELETE` on all 15 tables to `service_role` only. Client-side roles (`anon`/`authenticated`) are deliberately untouched — they already carry whatever they need on the tables they use. Post-migration audit query returns 0 tables missing `service_role` DML.

### UI: finals that have two legs
- `app/(admin)/admin/fixtures/manage/_desktop.tsx` and `_mobile.tsx`: `roundLabel()` no longer suppresses the leg suffix for `final`, so `Final Leg 1` / `Final Leg 2` render.
- `app/(public)/results/[id]/page.tsx` and `fixtures/[id]/page.tsx`: the OG badge becomes `FINAL — LEG 1` / `FINAL — LEG 2` instead of `FINAL` for both legs.
- Aggregate display extended to finals in `app/(public)/results/page.tsx`, `app/(public)/fixtures/[id]/page.tsx`, `app/(public)/results/[id]/page.tsx`, `app/(admin)/admin/fixtures/manage/page.tsx` and `app/(admin)/admin/results/submit/ResultSubmitClient.tsx` (the penalty toggle for leg 2 as well). Each previously hardcoded `['qf', 'sf']`.

## Verification
- `npx tsc --noEmit` clean; ESLint clean on every touched file (the 23 warnings under `app/(public)` are pre-existing, in polls/rules/standings/teams components that were not touched).
- `scripts/tmp-verify-ko-shape.ts` ran the real `generateTBCKnockouts()` against the live CAF Champions League and deleted the fixtures afterwards. Two-leg shape: QF leg 1 `2026-11-04`, QF leg 2 `11-05`, SF leg 1 `11-06`, SF leg 2 `11-07`, Final leg 1 `11-08`, Final leg 2 `11-09` — one round/leg per day, no collisions. One-leg run still produces a single matchday `301` final. Same result for the CAF Confederations League.
- `scripts/tmp-verify-two-leg-final.ts` created throwaway tournaments and asserted: no trophy after final leg 1; trophy after leg 2; the aggregate winner is recorded even when leg 2 is won by the losing side; a legacy single-leg final still awards from its own score; `awardTrophy()`'s forced winner overrides a higher home score. All passed; throwaway rows deleted (`trophies` still 14, no `ZZ tmp%` tournaments remain).
- Live DB confirmed: both CAF cups `qualifiers_per_group = 2`, `num_legs = 2`, 48 group fixtures each, 0 knockout fixtures, still `active`.

## Nedbank Cup (investigated, not changed)
The Nedbank Cup is **not** a league — it is a straight R32 → R16 → QF → SF → Final knockout (`matchday` 401-416, 51-58, 101-104, 201-202, 301) and starts `2026-10-30`. The `2026-11-04` QF/SF/Final pile-up is problem 3 above. `scripts/tmp-sim-nedbank-reschedule.ts` replays the fixed scheduler against its live bracket (excluding the cup's own fixtures from the slot count so they are not double-counted) and proposes only 3 moves: SF `201`/`202` → `2026-11-05` and Final `301` → `2026-11-06`. **Not applied** — rescheduling live fixtures needs the user's sign-off.

## Related files
- `lib/tournament-progression.ts`, `lib/aggregate.ts` — bracket shape, aggregate resolution, date assignment
- `app/api/admin/generate-knockouts/route.ts` — persists CAF `num_legs` into the generated bracket
- `.opencode/context/knockout-generation/knockout-daily-cap_2026-08-23.md` (the cap this fix respects)
- `.opencode/context/knockout-generation/32-team-r32-round_2026-09-27.md` (the R32 matchday 401-416 band that overlaps the ±10 sibling lookup)
- `.opencode/context/migration-history/data-api-default-privileges_2026-09-23.md` and `.opencode/context/migration-history/data-api-grants-oct-30_2026-09-23.md` — the default-privileges rule this grant fix extends to legacy tables
- `.opencode/context/knockout-generation/auto-super-cup-generation_2026-08-25.md` — `checkAndCreateSuperCup()` reads `trophies`, which is one of the 15 tables that lost its grants

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `scripts/tmp-debug-trophy.ts` | Throwaway tournament used to reproduce the silent `awardTrophy()` failure before `trophies` grants were restored. Marked "Not for commit". | `.recycle/tmp-debug-trophy_2026-09-30.ts` |
| `scripts/tmp-sim-nedbank-reschedule.ts` | Read-only replay of `assignKnockoutDates()` against the Nedbank Cup bracket, used to propose the 3 fixture moves above. Marked "Not for commit". | `.recycle/tmp-sim-nedbank-reschedule_2026-09-30.ts` |
| `scripts/tmp-verify-ko-shape.ts` | Rollback-transaction dry run of `generateTBCKnockouts()` proving the 8-team two-leg bracket shape and date spacing. Marked "Not for commit". | `.recycle/tmp-verify-ko-shape_2026-09-30.ts` |
| `scripts/tmp-verify-two-leg-final.ts` | Throwaway-tournament assertions for two-leg final trophy resolution (no award on leg 1, aggregate winner on leg 2, legacy single-leg still works, forced winner honoured). Marked "Not for commit". | `.recycle/tmp-verify-two-leg-final_2026-09-30.ts` |