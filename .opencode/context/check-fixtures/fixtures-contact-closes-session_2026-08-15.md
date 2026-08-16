# Check-Fixtures Contact Closes the Session

## Problem
After picking a fixture number in the `check fixtures` flow and getting the opponent's contact, the bot re-prompted "Reply with a number from the list, or type a date..." instead of ending the session. The session stayed in `awaiting_fixtures_action`, so the next message re-entered the handler and hit the catch-all re-prompt.

## Fix (`app/api/webhook/route.ts` → `sendOpponentContact`)
The session is now cleared (silently, no closing message) once the contact request is resolved:
- **Opponent not found** → `clearSession(from)` before replying "Could not find the opponent for that fixture."
- **No number saved** → `clearSession(from)` before replying "No contact number is saved for X yet."
- **Success** → `clearSession(from)` after the contact card is sent (or the fallback `+{phone}` text message).

The **fixture load failure** branch ("Could not load that fixture. Try again.") is unchanged — the session stays open so the user can retry with another number.

No DB migration needed — `clearSession` deletes the `whatsapp_sessions` row.

## Verified
- `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
