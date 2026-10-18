# Revert the mistaken Upington City vs Orbit College forfeit and its carry-over ripple

Added `scripts/fix-upington-orbit-backdoor-revert.ts` to undo a forfeit that was
recorded against Upington City vs Orbit College when the game was actually a
backdoor (no response), and to unwind the carry-over forfeit balance that this
mistake pushed onto Upington City vs The Bees. This is the same class of fix as
`.opencode/context/forfeit-balances/revert-stellenbosch-mistaken-forfeit_2026-10-16.md`,
which the user asked for first on the same "one mistaken forfeit corrupts a
second, unrelated match" pattern.

## Problem

Two Motsepe Foundation Championship results were wrong because a single forfeit
was recorded where a backdoor should have been:

1. **Upington City 0-6 Orbit College** (fixture
   `589f4491-4d40-4a01-970e-bc598af03d9d`, result `9a561746`) was written as an
   abandoned forfeit (`is_abandoned=true`, `abandoned_type='home'`,
   `override_reason='match marked as forfeit'`). Upington City (karabo_) had not
   responded, so the game was meant to be a plain **0-3 backdoor win** for Orbit
   College, not a 6-0 forfeit. The forfeit had two side effects:
   - it created a 6-goal carry-over forfeit balance (`cf3837f6`,
     `opponent_score=6`, `forfeiting_score=0`) for karabo_/Upington City; and
   - the trigger bumped `teams.abandon_count` to 1 for Upington City.
2. That balance was then **consumed on Upington City vs The Bees** (fixture
   `46e9a45d-7699-4ed8-af7c-9bb12c5453b4`, result `d1b12f91`), where the real
   score was a **3-0 Upington City win**. Applying the balance added the 6
   conceded goals to the opponent side, turning it into a **3-6 loss**, and
   stamped `override_reason` with a `forfeit_note:589f4491…` explaining the
   adjustment.

Because game 1 was not a forfeit at all, no balance should ever have existed, so
game 2 was never legitimately affected. The chain had to be unwound from the
source rather than patched at the consuming end — see
`.opencode/context/forfeit-balances/forfeit-carryover-discards-forfeiter-score_2026-10-11.md`
for the carry-over rule that produced the 3-6, and
`.opencode/context/forfeit-balances/backdoor-applies-forfeit-balances_2026-10-10.md`
for where backdoor approval learned to apply balances.

## Fix

New script `scripts/fix-upington-orbit-backdoor-revert.ts` (run with
`npx tsx scripts/fix-upington-orbit-backdoor-revert.ts`), following the shape of
`scripts/fix-stellenbosch-forfeit-revert.ts`. It:

1. Reverts **Upington City vs Orbit College** to a plain **0-3**: `home_score=0`,
   `away_score=3`, `is_abandoned=false`, `abandoned_type=null`,
   `override_reason=null`. This is byte-for-byte what the backdoor approve route
   (`app/api/admin/backdoor/approve/route.ts`) writes for a fresh fixture — no
   `absent` marker, so the standings engine scores it as a normal 0-3 loss (no
   `absent++`, no `-3GD`), exactly as a genuine approved backdoor behaves.
2. Reverts **Upington City vs The Bees** to the real **3-0** and clears the
   `forfeit_note` override reason.
3. **Deletes** forfeit balance `cf3837f6` so it can never be re-applied by the
   reset/reinstatement logic in `app/api/webhook/route.ts` (which restores
   `remaining=1` when a consuming fixture is reset).
4. Decrements `teams.abandon_count` for Upington City by 1 (floored at 0). The
   DB trigger in `supabase/migrations/003_triggers_functions.sql` only ever
   `+1`s on `is_abandoned`, and the standings rebuild does not touch
   `abandon_count`, so this is the manual inverse. Verified that this forfeit was
   Upington City's **only** abandoned result across all seasons, so the count
   went 1 → 0.
5. Rebuilds **Motsepe Foundation Championship** standings
   (`5a267e10-0edd-42f0-8f04-b28ec40713f8`) from scratch via
   `recalculateStandings()` from `lib/standings-engine.ts`. This is mandatory:
   the `on_result_insert` trigger is `AFTER INSERT OR UPDATE` and therefore
   **additive on UPDATE**, so updating the two result rows double-counted on top
   of the old deltas until the full delete-and-rebuild replaced them. Result:
   16 standings rows written, 240 fixtures processed.

### Verified outcome

| Team | Before → After |
|---|---|
| Orbit College | GF 78 → 75 (−3 from the 0-6 → 0-3 change); Pts 39 unchanged |
| Upington City | Pts 32 → 35, GA 44 → 35 (−6 Bees, −3 Orbit), W 10 → 11, L 6 → 5, absent 4 → 3, gd_penalty −12 → −9, CS 5 → 6, GF 60 unchanged |
| The Bees | Pts 19 → 16, GF 31 → 25 (−6), W 6 → 5, L 6 → 7, GA 28 unchanged |

Both results now read `override_reason=null`, `is_abandoned=false`; the
`forfeit_balances` row is gone; `abandon_count=0`.

The approved backdoor submission on the Bees fixture (`15a73594`,
`side_claimed='away'`, status `approved`) was **left intact** — it is consistent
with the restored 3-0 (the away side, The Bees, is the non-responding side, so
home wins 3-0). Only the carry-over balance, not the submission, was the error.
The Orbit College fixture has **no** `backdoor_submissions` row (it was logged as
a forfeit, never as a backdoor claim); none was invented, since the result row
alone is what drives standings.
