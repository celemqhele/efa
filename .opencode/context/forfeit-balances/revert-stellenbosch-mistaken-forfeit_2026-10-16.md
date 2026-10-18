# Reverted mistaken Stellenbosch forfeit (9-0 -> 6-0) and its TS Galaxy ripple

Reverted a mistaken forfeit marking on Stellenbosch vs Midlands Wanderers back to
the real 6-0 result, undid the 9-goal carry-over that had turned TS Galaxy vs
Midlands Wanderers from 4-7 into 13-7, and deleted the resulting forfeit balance
for the Midlands Wanderers manager. This was a one-off data repair via
`scripts/fix-stellenbosch-forfeit-revert.ts`, not a code change.

## Problem

The submitter entered the real 6-0 Stellenbosch win but then mistakenly marked
the match as forfeited. The forfeit flow adjusted the score to 9-0 and minted a
9-opponent-goal carry-over balance for Midlands Wanderers' manager (phiwayinkosi,
id `401bb18b-8b3b-4f05-966f-36e6d5ccdc1b`), noted as "Forfeit: 9-0 (adjusted
from 6-0)". That balance was then consumed on the next fixture, TS Galaxy vs
Midlands Wanderers, adding 9 to TS Galaxy's side and turning the real 4-7 Midlands
win into 13-7 (the result row's own `override_reason` forfeit_note said so
verbatim). Both results fed the Betway Premiership standings.

## Fix

One-off script `scripts/fix-stellenbosch-forfeit-revert.ts` (pattern follows
`scripts/fix-psg-mci-result.ts`):

1. Stellenbosch vs Midlands Wanderers (`e2c790ce-59e3-4315-987c-2ca1b5983d8f`):
   result updated to 6-0, `is_abandoned=false`, `abandoned_type=null`,
   `override_reason=null` (was `match marked as forfeit`).
2. TS Galaxy vs Midlands Wanderers (`6290bb68-b370-4426-8276-059f989c57bb`):
   result updated to the real 4-7, `override_reason=null` (was the
   `forfeit_note:...` carry-over note).
3. Deleted forfeit balance row `2ba6c88a-0638-45b7-a582-fc74ed0fa7dc`
   (opponent_score 9, remaining 0, consumed by the TS Galaxy fixture).
4. Rebuilt Betway Premiership standings with `recalculateStandings()`
   (`18d4f540-0246-42ae-8699-64d13d0a2ae7`) — required because the
   `update_standings_after_result` trigger is ADDITIVE on UPDATE as well as
   INSERT, so a plain UPDATE would have double-counted; the full rebuild
   (delete + recompute from confirmed results) is authoritative.

## Verification

Script self-verifies and passed. Post-repair standings for the affected teams
(18 played each): Stellenbosch 43 pts (W14 D1 L2, 77-24), TS Galaxy 33 pts
(W10 D3 L5, 80-52), Midlands Wanderers 32 pts (W10 D2 L5, 66-48).

## Context chain (by path)

- Forfeit carry-over rule (only conceded score carries): `.opencode/context/forfeit-balances/forfeit-carryover-discards-forfeiter-score_2026-10-11.md`
- Shared apply helper / backdoor apply: `.opencode/context/forfeit-balances/backdoor-applies-forfeit-balances_2026-10-10.md`
- Resubmission restore/consume semantics: `.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md`
- Reset reinstates balances: `.opencode/context/forfeit-balances/admin-reset-reinstates-forfeit-balances_2026-10-10.md`
- Prior one-off result repair this script's structure follows: N/A (script lives at `scripts/fix-psg-mci-result.ts`)

## Restore File Section
No repo files were deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
