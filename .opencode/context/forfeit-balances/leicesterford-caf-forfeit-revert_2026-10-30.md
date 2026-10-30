# Reverted a mistaken CAF Confederations League forfeit and its 6-6 carry-over ripple

Added `scripts/fix-leicesterford-forfeit-revert.ts` to undo a forfeit recorded on
Leicesterford City vs Upington City and to unwind the 6-goal carry-over balance it
pushed onto Leicesterford City vs Orbit College, turning a real 6-0 win into 6-6.
This is the same "one mistaken forfeit corrupts a second, unrelated match" repair
as `.opencode/context/forfeit-balances/revert-upington-orbit-forfeit_2026-10-18.md`
and `.opencode/context/forfeit-balances/revert-stellenbosch-mistaken-forfeit_2026-10-16.md`
— Upington City features again, this time as the team that wrongly gained from the
forfeit rather than the one that was penalised.

## Problem

Two CAF Confederations League group-stage results were wrong because a single
forfeit was recorded where a plain result should have stood:

1. **Leicesterford City 0-6 Upington City** (fixture
   `f6aff5a1-3473-4893-918d-17652e015156`, result `95f82e6e`) was submitted by the
   Upington manager as the real **0-3** but flagged as a forfeit (home). The forfeit
   flow in `app/api/submit-match/route.ts` adds +3 to the non-forfeiting side, so
   the row became **0-6** with `is_abandoned=true`, `abandoned_type='home'`,
   `override_reason='match marked as forfeit'`. It also minted a 6-goal carry-over
   balance for the Leicesterford manager (`3a2e48df`, `opponent_score=6`,
   `forfeiting_score=0`, `half_time_note='Forfeit: 0-6 (adjusted from 0-3)'`).
2. That balance was then **consumed on Leicesterford City vs Orbit College**
   (fixture `28cbcc6d-aa7e-4c5c-819c-a438941115c2`, result `62347612`), where the
   real score was a **6-0 Leicesterford win**. The carry-over added Orbit College's
   6 goals, turning it into **6-6**, with `override_reason` stamped
   `forfeit_note:f6aff5a1…:Leicesterford City forfeited a match that ended in 6-0,
   so this 6-0 win became 6-6 in favour of Orbit College.`

The user confirmed the forfeit does not apply: fixture 1 should be the **3-0**
Upington win that was actually submitted (`0-3` from the home side's perspective),
and fixture 2 the real **6-0**. Because no forfeit ever stood, no carry-over
balance should have existed, so the ripple on fixture 2 was never legitimate.

## Fix

New script `scripts/fix-leicesterford-forfeit-revert.ts` (run with
`npx tsx scripts/fix-leicesterford-forfeit-revert.ts`), following the shape of
`scripts/fix-upington-orbit-backdoor-revert.ts`. It:

1. Reverts **Leicesterford City vs Upington City** to a plain **0-3**:
   `home_score=0`, `away_score=3`, `is_abandoned=false`, `abandoned_type=null`,
   `override_reason=null`. With no `absent` marker in `override_reason` and no
   `abandoned_type`, `lib/standings-engine.ts` scores it as an ordinary 0-3 loss
   (no `absent++`, no `-3` GD penalty) — the same treatment as a genuine
   walkover/backdoor result.
2. Reverts **Leicesterford City vs Orbit College** to the real **6-0** and clears
   the `forfeit_note` override reason.
3. **Deletes** forfeit balance `3a2e48df` so it can never be re-applied by the
   reset/reinstatement logic in `app/api/webhook/route.ts`.
4. Syncs both `result_confirmations` rows to the corrected scores — the public
   fixture page (`app/(public)/fixtures/[id]/page.tsx`) renders them, so they would
   otherwise still advertise 0-6 / 6-6.
5. Rebuilds **CAF Confederations League** group standings
   (`81f77443-f442-4a5f-b7b8-6fabac3f92d8`) from scratch via `recalculateStandings()`
   from `lib/standings-engine.ts`. Mandatory: the `on_result_insert` trigger is
   `AFTER INSERT OR UPDATE` and additive on both the `standings` and
   `group_standings` branches, so the UPDATEs double-counted until the full
   delete-and-rebuild replaced them. Result: 16 group rows written, 48 fixtures
   processed.

### No `abandon_count` step

Unlike the earlier reverts, there was nothing to decrement. Both fixtures are
`round_type='group'`, and the live `update_standings_after_result()` trigger
returns from its group branch **before** the `abandon_count` block that exists only
on the league path (see `supabase/migrations/074_fix_group_result_status_confirm.sql`
and `supabase/migrations/107_absence_carryover_standings.sql`). Leicesterford City's
`abandon_count` was therefore still 0, and the script asserts it stays 0.

### Verified outcome

Group B before → after:

| Team | Before → After |
|---|---|
| Upington City | Pts 9 unchanged; GF 18 → 15, GA 3 unchanged (6-0 → 3-0 win) |
| Leicesterford City | Pts 4 → 6, W 1 → 2, D 1 → 0, L 1 unchanged, GF 9 unchanged, GA 12 → 3 (−6 Orbit, −3 Upington), absent 1 → 0, gd_penalty −3 → 0 |
| Orbit College | Pts 4 → 3, D 1 → 0, L 1 → 2, GF 12 → 6 (−6), GA 15 unchanged |
| Lerumo Lions | Unchanged (0 pts, absent 3, −9 GD) |

Both results now read `override_reason=null`, `is_abandoned=false`,
`abandoned_type=null`; the `forfeit_balances` row is gone; both fixtures remain
`status='confirmed'`. The 6 remaining `forfeit_balances` rows for the Leicesterford
manager are all 0-goal and already consumed (`remaining=0`), so they have no effect.

## Context chain (by path)

- Prior identical repair, different season: `.opencode/context/forfeit-balances/revert-upington-orbit-forfeit_2026-10-18.md`
- Prior identical repair, Betway Premiership: `.opencode/context/forfeit-balances/revert-stellenbosch-mistaken-forfeit_2026-10-16.md`
- Forfeit carry-over rule (only conceded score carries): `.opencode/context/forfeit-balances/forfeit-carryover-discards-forfeiter-score_2026-10-11.md`
- Carry-over applied on walkovers/absences + absence fallback for plain 0-3/3-0: `.opencode/context/forfeit-balances/forfeit-carryover-absence-walkover_2026-10-27.md`
- Shared apply helper: `.opencode/context/forfeit-balances/backdoor-applies-forfeit-balances_2026-10-10.md`
- Reset reinstates balances: `.opencode/context/forfeit-balances/admin-reset-reinstates-forfeit-balances_2026-10-10.md`

## Restore File Section

No repo files were deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
