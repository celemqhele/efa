# Admin reset reinstates forfeit balances (carry-over scores)

The admin "Reset Result" action (`app/api/admin/reset-fixture/route.ts`) now re-opens any forfeit carry-over balances the fixture had consumed, so the forfeit scores become available again when the match is resubmitted. This is a follow-up to the carry-over-tracking work in `.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md`: the user reset a match as admin (which deletes the result) and found the two forfeit scores Hope FC had applied were stranded (the fixture still marked them consumed, but the result citing them was gone). They asked for the scores to be reinstated and for the reset path to always do this.

## Problem

`reset-fixture` deleted the `results`/`result_confirmations` rows and set the fixture back to `scheduled`, but never touched `forfeit_balances`. After a reset the balances were left at `remaining = 0` with `consumed_by_fixture_id = <fixture>` — so the forfeit scores were neither in the (now deleted) result nor available to re-apply. The earlier submit-path restore only re-opens balances on resubmission; it never helped the reset itself.

## Fix

- `app/api/admin/reset-fixture/route.ts`: added step 3b, before the status update:
  ```ts
  await db.from('forfeit_balances')
    .update({ remaining: 1, consumed_by_fixture_id: null })
    .eq('consumed_by_fixture_id', fixture_id)
  ```
  This matches only balances this exact fixture consumed (keyed by the `consumed_by_fixture_id` column added in migration `098_forfeit_balance_consumed_by.sql`), so unrelated balances are untouched. Standings already recalc after a reset (step 5), and the reinstated balances will be re-applied by the normal submit path on the next submission.
- Data repair (run once via `npm run db`): reinstated the two Hope FC balances the user's reset had stranded, `3b2b9437-07da-4239-9478-ab750243de88` (opponent_score 6, source fixture `8aab9af9-…` itself) and `0366a757-8254-4d4c-ae41-9f368bacd6a8` (opponent_score 3, source fixture `8743af05-…`), by setting `remaining = 1, consumed_by_fixture_id = null where consumed_by_fixture_id = '8aab9af9-5684-4373-9973-94a676140def'` (2 rows).

## Notes

- The `Reset Result` button on both the admin results-submit page (`ResultSubmitClient.tsx`) and the admin fixtures-manage page (`FixtureActions.tsx`) call this same route, so both are covered.
- The WhatsApp `resetAndResubmit` path (`app/api/webhook/route.ts`) deletes then immediately rewrites the result, and already re-opens/re-applies balances via `writeResultToDb` (see the forfeit-balance-survives-resubmission context file), so it needs no change here.

## Verification

- `npx tsc --noEmit` clean; `next lint` on the touched route clean.
- DB check after repair: both balances show `remaining = 1`, `consumed_by_fixture_id = null`.

## Files touched

- `app/api/admin/reset-fixture/route.ts`

## Context chain (by path)

- `.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md` (consumed_by tracking + submit-path restore)
- `.opencode/context/submit-portal/forfeit-notes-cite-all-applied_2026-10-10.md`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
