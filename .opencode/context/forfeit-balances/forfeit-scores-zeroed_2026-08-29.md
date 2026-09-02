# Forfeit scores reset to 0 for all managers (29 Aug)

The user asked to wipe the carried-over forfeit scores for every manager, so a single
SQL `UPDATE` set `forfeiting_score` and `opponent_score` to 0 on all 47
`forfeit_balances` rows. This is a follow-up to the manager-based forfeit work in
`.opencode/context/forfeit-balances/forfeit-manager-migration_2026-08-25.md` — the
historical scores built up a lot of lopsided carry-overs and the user wanted a clean
slate on the scores without deleting the balance records.

## Change

`UPDATE forfeit_balances SET forfeiting_score = 0, opponent_score = 0;` — 47 rows
affected.

- Verified: `non_zero` count (rows where either score column is non-zero) dropped to
  `0`.
- `remaining` was left untouched: 7 balances still carry forward as active
  (`remaining > 0`) but now apply a **0-0** score instead of the old carried scores
  via the WhatsApp auto-apply in `app/api/webhook/route.ts` or the "Use forfeit
  balance" button reviewed in `.opencode/context/forfeit-balances/forfeit-balance-use-fix_2026-08-16.md`.

## Notes
- No schema change and no code change — data reset only, so no migration file was
  needed.