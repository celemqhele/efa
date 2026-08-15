# WhatsApp Contact Card Phone-Format Fix

## Problem
Selecting a fixture number in the `check fixtures` flow (`awaiting_fixtures_action`) is supposed to send the opponent manager's contact card. For some opponents nothing was sent — the Vercel logs showed:

```
WhatsApp contact send failed: { error: { message: "(#131009) Parameter value is not valid", code: 131009, ... } }
```

The webhook handler is `sendOpponentContact()` in `app/api/webhook/route.ts`.

## Root cause
`sendOpponentContact` sent the opponent manager's stored `profiles.phone` with only non-digits stripped:

```ts
const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, '') : null
```

The `profiles` table stores numbers in inconsistent formats. WhatsApp's contacts API requires an **international E.164** number for the contact card, and rejects local-format numbers:

- International with country code (passes as-is after strip): `+27732509506`, `+233591519713`, `+264 81 475 7719`
- **Local SA (breaks the card):** `0795932223` (Al Ettifaq's manager) → sent as `0795932223`, invalid → error 131009
- Missing: no number → already handled by the plain-text "No contact number is saved" fallback

## Fix
1. **New helper `toInternationalPhone()`** in `app/api/webhook/route.ts` (next to `normalizePhone`/`phoneNumbersMatch`):
   - strips non-digits (`normalizePhone`)
   - drops a leading `00` (international dialing prefix)
   - if the number starts with `0` (national/local format) → prepends `27` (SA default), e.g. `0795932223` → `27795932223`
   - otherwise passes through unchanged (handles Ghana `+233`, Namibia `+264`, etc.)
2. **`sendOpponentContact`** uses `toInternationalPhone(phoneRaw)` instead of the raw digit-strip.
3. **Defensive fallback:** `sendContactMessage()` in `lib/whatsapp.ts` now returns a boolean (true on success). If the contact card fails, `sendOpponentContact` sends a plain-text message with the number instead, so the user is never left with a silent failure.

## Design notes
- The strategy is "pass-through + SA default": numbers that already carry a country code are used unchanged; only local-format numbers get the SA country code prepended. All 17 local-format numbers currently in the DB are SA (the Ghana/Namibia users stored international format), so this fixes every current case.
- Known limitation: a future local-format number from a non-SA country (e.g. a Ghanaian `024...` stored without `+233`) would be mis-assumed SA. If that becomes a real case, add a `profiles.country_code` column populated from the manager's WhatsApp `from` number (always international E.164) and use it in `toInternationalPhone`.
- No data migration needed — normalization happens at send time.

## Verified
- `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
