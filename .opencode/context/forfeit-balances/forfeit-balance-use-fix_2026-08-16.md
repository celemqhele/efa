# Forfeit balance — "Use" button did nothing; now always carries over (16 Aug)

## Problem
Two symptoms, one feature:
1. **Website**: on the result submit page, clicking "Use forfeit balance" did
   nothing.
2. **WhatsApp**: balances were barely ever consumed — user suspected AI fails to
   apply them too.

## Root Cause
- `/api/admin/forfeit-balances/use` (`app/api/admin/forfeit-balances/use/route.ts`)
  required an **already-saved `results` row** for the fixture and returned
  `400 "No result found for this fixture yet"` otherwise. The submit page is used
  to enter a **new** result, so the button always 400'd — and the client silently
  ignored non-OK responses. Hence "does nothing".
- WhatsApp auto-apply in `writeResultToDb` only ran when `homeScore !== awayScore`
  **and** the forfeiting team was the current *loser*. DB check showed 9 active
  balances (`remaining = 1`); many sat on the pair's last meeting or on matches the
  forfeiting team won/drew, so they never fired.

## Decision (user)
Always carry the forfeit-match score over to the next meeting between the same two
teams, consistently on website and WhatsApp — regardless of who is winning.

## Fix
- `app/(admin)/admin/results/submit/ResultSubmitClient.tsx`:
  - `handleUseForfeitBalance` now applies the balance **locally** from the
    `forfeitBalances` state (which already includes `forfeiting_score`,
    `opponent_score`, `forfeiting_team_id` via the GET route): forfeiting team
    gets `forfeiting_score`, opponent gets `opponent_score`; empty score inputs
    treated as 0. Removes the used balance from the badge list, tracks it in
    `usedBalanceIds`, and shows an "Forfeit balance applied: …" note.
  - Reset `usedBalanceIds`/note in `resetOcr()`; sends
    `used_forfeit_balance_ids` in the finalise payload.
- `app/api/admin/finalise-result/route.ts`: after the result is saved, validates
  each used balance belongs to the fixture's team pair and sets `remaining = 0`.
- `app/api/webhook/route.ts` `writeResultToDb`: replaced the loser-gated lookup
  with a query for **any** active balance between the fixture's two teams (either
  direction), always applies `forfeiting_score`/`opponent_score` to the correct
  side, and sets `remaining = 0`. Still skipped on `isForfeitConfirm` (a just-created
  forfeit must not carry into itself — `handleForfeitYes` already added the +3).
- Retired `app/api/admin/forfeit-balances/use/route.ts` (now unused) → `.recycle/`.

## Notes / Gotchas
- 9 balances were left with `remaining = 1` from before the fix; going forward the
  next meeting between each pair will consume them automatically (WhatsApp) or via
  the "Use forfeit balance" button (website).
- The GET list route `app/api/admin/forfeit-balances/route.ts` already returns
  `*, forfeiting_team, opponent_team` filtered to `.gt('remaining',0)`.
- `npx tsc --noEmit` and `npm run lint` pass.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `app/api/admin/forfeit-balances/use/route.ts` | POST handler that required an existing `results` row and 400'd on new submissions; replaced by client-side apply + finalise consumption | `.recycle/forfeit-balances-use-route.ts` |
