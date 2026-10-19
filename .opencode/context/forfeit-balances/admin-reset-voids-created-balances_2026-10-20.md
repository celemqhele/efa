# Admin Reset Result now voids the forfeit balance the match created

An admin "Reset Result" now deletes the carry-over forfeit balance that the
reset match had created, and trims any later result that already consumed it, so
a forfeit that no longer stands stops punishing the manager in the next game.
The same commit stops the three forfeit-balance writers from stacking duplicate
penalties for one match, and repaired the two live cases the admin reported.

Follow-up to `.opencode/context/forfeit-balances/admin-reset-reinstates-forfeit-balances_2026-10-10.md`
(which made a reset RE-OPEN balances the reset match had consumed) and to
`.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md`
(the carry-over design itself). After that change the admin reported that the
opposite half was still broken: "when i reset score as admin, if there was a
forfeit, remove the forfeit balance added because its no longer valid. i have a
hunch that it stays."

## Problem

1. **A reset left the balance the match CREATED behind.** `forfeit_balances` has
   two different fixture columns: `fixture_id` (the match that PRODUCED the
   penalty) and `consumed_by_fixture_id` (the match that APPLIED it).
   `app/api/admin/reset-fixture/route.ts` step 3b only re-opened balances the
   reset match had CONSUMED (`remaining = 1`, `consumed_by_fixture_id = null`
   where `consumed_by_fixture_id = this fixture`). Nothing ever removed the row
   whose `fixture_id = this fixture`, so the penalty survived the reset and was
   still `remaining = 1`, ready to be added to the manager's *next* match.
2. **Live confirmation of the hunch.** Supersport vs Milford
   (`1b64f884-5012-4421-b008-2fb1b1eb0ffc`) had
   `fixtures.whatsapp_reset_count = 1` and its current result was the auto 0-0
   placeholder, yet **three** balances still existed for that fixture:
   two for `anele_arh` and one for `listar03`, every one `remaining = 1` and
   unconsumed. All three would have been served as a penalty in a future match
   even though the forfeit result they came from had been reset. They were
   created by the old flow, which inserted a fresh row on **every** resubmission
   (`submitResult` had no dedupe), which is also how two identical
   `opponent_score 7` rows for the same manager were produced.
3. **TS Galaxy vs Polokwane City was a 3-0 win recorded as a forfeit.**
   The fixture (`5967ac6f-d9b3-4b61-85f2-d7e817d06b6d`) was submitted through
   the portal as `forfeit=yes`, which does two things at once: adds **+3** to the
   winner's typed score (3-0 became 6-0) and creates a carry-over balance with
   `opponent_score = 6` for the losing manager (`matolo7`). That balance was then
   consumed by Midlands Wanderers vs Polokwane City
   (`ccd8a349-dce5-4199-ae4a-6f347d4b640b`), pushing a genuine 8-4 win to 14-4.
   The admin confirmed the intent: "TS Galaxy vs Polokwane City is supposed to be
   backdoor win of 3-0. not 3-0 plus forfeit."

## Fix

- **New helper `lib/forfeit-balance-revert.ts`** with
  `voidBalancesCreatedBy(db, fixtureId)`. It is the exact inverse of
  `lib/forfeit-balance-apply.ts` (which does `+= opponent_score`): for every row
  with `fixture_id = fixtureId` it
    - trims the consuming fixture's result by `-= opponent_score` on the
      opponent's side (clamped at 0), so the inflated score goes back to the real
      one,
    - removes the `forfeit_note:<sourceFixtureId>:` line it had appended to that
      result's `override_reason`,
    - writes a `forfeit_balance_voided` audit row per adjustment,
    - deletes every balance row with `fixture_id = fixtureId`.
  Balances the fixture merely CONSUMED are untouched (the reset route re-opens
  those separately, from
  `.opencode/context/forfeit-balances/admin-reset-reinstates-forfeit-balances_2026-10-10.md`).
- **`app/api/admin/reset-fixture/route.ts`** calls the helper as new step 3c,
  recalculates standings for any other tournament whose result was trimmed, and
  returns `forfeit_balances_voided` / `forfeit_consumers_adjusted` /
  `extra_recalcs` (also recorded in the audit log) so a reset is auditable.
- **One penalty per match, in all three writers.** `app/api/submit-match/route.ts`
  already deletes this fixture's prior balances before rewriting a result;
  `app/api/admin/finalise-result/route.ts` and the WhatsApp forfeit path in
  `app/api/webhook/route.ts` now do the same, scoped with
  `.is('consumed_by_fixture_id', null)` so balances this fixture *consumed*
  (which belong to other fixtures) are never touched.
- **Data repair** in `scripts/fix-stale-forfeit-balances-2026-10-20.ts`
  (dry-run with `--dry`), run against production:
    - Part A: TS Galaxy vs Polokwane City set to 3-0 with the forfeit marker
      cleared (`is_abandoned = false`, `abandoned_type = null`,
      `override_reason = 'Walkover 3-0 (forfeit adjustment removed)'`), then
      `voidBalancesCreatedBy` deleted its balance and trimmed Midlands Wanderers
      vs Polokwane City 14-4 -> 8-4.
    - Part B: deleted the three stale Supersport vs Milford balances, plus two
      historical duplicate rows (Bournemouth vs Newcastle United, Barcelona vs
      Sporting Cp), both `remaining = 0` and unconsumed.
    - Standings recalculated afterwards.

## Result

- Supersport vs Milford no longer carries any phantom penalty; only two active
  (`remaining = 1`) balances remain league-wide, and both come from genuine
  forfeits whose results still stand (`is_abandoned = true`, no resets):
  TS Galaxy vs TUT FC and Sekhukhune United vs Durban City.
- TS Galaxy 3-0 Polokwane City, Midlands Wanderers 8-4 Polokwane City.
- A future reset of a forfeit match cannot leave its penalty behind, and a
  corrected/resubmitted forfeit can no longer stack a second balance.
