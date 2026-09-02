# Reset Colombia 6-2 Argentina to scheduled & deduct the forfeit score (30 Aug)

Reset the Colombia vs Argentina group-B fixture (matchday 8) back to `scheduled`,
deleted its `6-2` forfeit result, and **deducted** the forfeit score by deleting its
`forfeit_balances` carry-over row — the forfeit was no longer valid. This is a
follow-up to the manager-based forfeit work in
`.opencode/context/forfeit-balances/forfeit-manager-migration_2026-08-25.md` and the
score reset in `.opencode/context/forfeit-balances/forfeit-scores-zeroed_2026-08-29.md`:
a fresh forfeit recorded today (note `Forfeit: 6-2 (adjusted from 3-2)`) was ruled
invalid, so both the result and its carried-over forfeit balance had to be undone.

## Problem

Around 2026-08-30T16:52 the Colombia vs Argentina fixture
(`fd5a3501-aa31-45bc-9da9-42d3936b60a0`) was recorded as a forfeit: a `results` row
(`home 6, away 2`, `is_abandoned = true`, `abandoned_type = 'away'` — Argentina
forfeited) plus a `forfeit_balances` row (`7d3f7b1b-b576-4001-9196-994c1bdca356`)
with `opponent_score = 3`, `forfeiting_score = 2`, `half_time_note =
'Forfeit: 6-2 (adjusted from 3-2)'`, `remaining = 1`. That forfeit was deemed **no
longer valid**, so the fixture needed to go back to `scheduled` and the forfeit score
deducted (removed) so it could not carry over into the next Colombia–Argentina
meeting (matchday 62 on 2026-09-11).

## Fix (done via direct SQL, `npm run db`)

Ran a transactional reset script against the fixture:

1. `DELETE` the `forfeit_balances` row for this fixture — this is the **deduct the
   forfeit score** step; it removes the pending carry-over (would otherwise have been
   auto-applied to the next meeting via `app/api/webhook/route.ts` in
   `writeResultToDb`).
2. `DELETE` `result_confirmations` for the fixture.
3. `DELETE` `match_stats` (none existed) then `DELETE` the `results` row.
4. `UPDATE` the fixture to `status = 'scheduled'`.
5. Inserted an `audit_log` row (`action = 'reset_fixture_and_forfeit'`, admin
   `celemqhele`).

Verified after the reset:

- Fixture `status = 'scheduled'`; `results` = 0, `forfeit_balances` = 0,
  `result_confirmations` = 0 for the fixture.
- Group B `group_standings` were unaffected/correct — the forfeit game had **not**
  been baked into the standings (Colombia still 1 played / 3-10 lOSS vs Morocco,
  Argentina 1 played / 2-2 draw vs Tunisia), so no standings arithmetic was needed;
  deleting the result + forfeit just stops it counting and stops any carry-over.
- No schema change; this was a data reset like
  `.opencode/context/forfeit-balances/forfeit-scores-zeroed_2026-08-29.md`, so no
  migration file was created.

## Notes

- The forfeit game had already been excluded from the live group standings (unlike
  the `updateLeagueStandings` path), so "deducting" the forfeit score here meant
  deleting the `forfeit_balances` carry-over row rather than reversing a standings
  delta — no `recalculateStandings` call was required, though one would be harmless.
- Reused the audit-log/admin convention from the existing `reset-fixture` route
  (`app/api/admin/reset-fixture/route.ts`), but extended to also clear the forfeit
  balance which that route does not handle.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| (none) | Data reset only — no files moved | N/A |
