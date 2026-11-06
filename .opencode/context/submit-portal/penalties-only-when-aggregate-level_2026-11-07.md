# Submit portal: penalties only when the knockout aggregate is level

## What was done
Fixed the `/submit-match/[code]` portal so penalty scores are only shown and required when the whole knockout TIE is level on aggregate, not merely when the leg-2 score happens to be a draw. A 4-4 second leg after a 3-0 first leg is now treated as a clear aggregate win: no shootout prompt, no penalty requirement, and any stale penalty values are cleared on save. The one existing result that had been given spurious penalties was cleaned up.

## Problem
After the earlier change that allowed penalties on knockout draws, `buildState()` in `lib/submit-match.ts` set `requiresPenalties = true` for any leg-2 two-legged knockout fixture. The portal then showed the penalty inputs and blocked submission whenever the typed leg-2 score was a draw (`home === away`), without looking at leg 1. So a manager entering `4-4` in leg 2 after winning leg 1 `3-0` was forced into a shootout that the tie did not need.

The live example found in Supabase: CAF Confederations League QF, leg 1 Kaizer Chiefs 2-3 Gomora United, leg 2 Gomora United 4-4 Kaizer Chiefs (aggregate 7-6 Gomora). The result row had `pen_home_score = 5`, `pen_away_score = 4`, which had no bearing on the winner.

## Fix
- `lib/submit-match.ts`
  - `loadFixture()` now also selects `matchday` (needed to locate the sibling leg 1, which sits 10 matchdays earlier).
  - new `loadLeg1Result(admin, fixture)` returns the leg-1 `{ home, away }` score for a leg-2 fixture, matched on `tournament_id` + `round_type` + `leg = 1` + `matchday - 10`.
  - `buildState()` now returns `rules.penaltiesPossible` (the fixture CAN go to a shootout) and `rules.leg1Result` instead of a blunt `requiresPenalties`.
- `app/submit-match/[code]/_portal.tsx`
  - `ResultPanel` computes the aggregate: leg-1 home + leg-2 away vs leg-1 away + leg-2 home (the legs have opposite home/away orientation, matching `computeAggregate()` in `lib/aggregate.ts`).
  - `needsPenalties = penaltiesPossible && !walkover && aggregate is level`.
  - The penalty block, the submit-time validation and the `penHomeScore`/`penAwayScore` payload fields all use `needsPenalties`.
  - When leg-1 data exists it shows a small `Aggregate: X - Y · decided on aggregate, no penalties` (or `· level, penalties will decide it`) line, so managers can see why no shootout is requested.
- `app/api/submit-match/route.ts`
  - `submitResult()` loads leg 1, computes `tieLevel` from the final stored scores (after walkover/forfeit/carry-over adjustments), and only stores penalty scores when the tie is level. Otherwise it writes `pen_home_score`/`pen_away_score` as `null`, which also clears stale pen values when a correction makes an earlier shootout unnecessary.

## Data cleanup
`supabase/migrations/112_clear_spurious_penalties_confed_qf.sql` nulls the penalty scores on the CAF Confed QF leg-2 result `aee8f4d0-dd53-4679-ad80-26f06f811273` (4-4, aggregate 7-6). The aggregate winner and progression are unchanged; only the unnecessary shootout values are removed. Applied and verified `pen_home_score = null`, `pen_away_score = null`.

## Verification
- `npx tsc --noEmit` clean.
- `npx next lint` on the changed files: only pre-existing unused-variable warnings.
- Supabase check: leg 1 at matchday 101 and leg 2 at matchday 111 (offset 10) for the affected tournament, confirming `loadLeg1Result` picks the correct sibling.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Where the penalty prompt was originally added: `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md`
- Invalid UTF-8 fix on the same penalty prompt: `.opencode/context/submit-portal/portal-invalid-utf8-em-dash_2026-11-04.md`
- Aggregate/tie-break rules used by progression: `.opencode/context/knockout-generation/knockout-0-0-gd-tiebreak_2026-09-23.md`
- Aggregate helper: `lib/aggregate.ts`; progression: `lib/tournament-progression.ts`
- Admin equivalent (manual penalty checkbox, not forced): `app/(admin)/admin/results/submit/ResultSubmitClient.tsx`
