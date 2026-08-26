# Forfeit balance WhatsApp notification — unclear message text (26 Aug)

## Problem
When a forfeit balance was applied during a WhatsApp result submission, the
notification was vague:
```
Forfeit balance applied: ManagerName (from OpponentTeam). Aggregate adjusted to 7-3.
```
Users couldn't tell who forfeited, against whom, or what the score became.

## Fix
Rewrote the forfeit balance note in `writeResultToDb` (`app/api/webhook/route.ts`)
to be personalized and specific:

1. **Recipient identification**: expanded the fixture query to include manager
   phone numbers; matches the sender's `from` number against the two fixture
   managers via `phoneNumbersMatch`.
2. **Team name pre-fetch**: single query to `teams` for both managers'
   `manager_id → name` map (avoids N+1 in the balances loop).
3. **Personalized messages**: each balance contributes a sentence — either
   `"You forfeited your last game against {opponent}"` or
   `"Your opponent ({forfeitTeam}) forfeited their last game against {opponent}"`.
4. **Final format**: combines the reason(s) with the fixture score using team
   names, e.g.:
   ```
   Your opponent (Orlando Pirates) forfeited their last game against Chiefs.
   Score: Chiefs 7-3 Orlando Pirates.
   ```

## Code Changes
- **`app/api/webhook/route.ts`** `writeResultToDb`:
  - Fixture query now selects `manager:profiles!teams_manager_id_fkey(phone)`
    on both team relations.
  - Added `recipientManagerId` lookup via `phoneNumbersMatch` on fixture
    managers' phone numbers.
  - Added `hName`/`aName` via `fixtureTeamName` for the score line.
  - Added `teamNames` map: single `teams` query by `manager_id` to get team
    names for both fixture managers.
  - Replaced `noteTeamNames` accumulator with `forfeitNoteParts` array of
    personalized sentences.
  - Final note uses team names instead of bare numbers.

## Notes
- `npx tsc --noEmit` passes (no new errors)
- `npm run lint` passes (only pre-existing warnings)
- `public/sw.js` had unrelated pre-existing changes, not committed
