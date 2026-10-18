# User management: set phones for mandane + yibanathi_ntantiso (2026-10-18)

Backfilled the WhatsApp mobile numbers for the two accounts created earlier the same day — the user supplied them after the fact ("forgot to say"). Both profiles had `phone = NULL`, so neither would have been reachable by the opponent-number reminder or linkable to an inbound WhatsApp sender.

Follows the digits-only canonical-storage pattern of `.opencode/context/user-management/update-matolo7-phone_2026-10-10.md` and `.opencode/context/user-management/fix-tildedot-phone_2026-10-07.md`.

## What ran

```sql
UPDATE public.profiles SET phone = '27762574462'
WHERE username = 'mandane' RETURNING id, username, phone;
-- mandane (6a97a4e2-6312-4689-9beb-35a1c07a8af4) -> 27762574462

UPDATE public.profiles SET phone = '27838468812'
WHERE username = 'yibanathi_ntantiso' RETURNING id, username, phone;
-- yibanathi_ntantiso (7820ba90-2d0c-44b0-8fb7-400d09505765) -> 27838468812
```

- `27762574462` = `+27 76 257 4462` (mandane)
- `27838468812` = `+27 83 846 8812` (yibanathi_ntantiso)

## Verification

- Both are exactly 11 digits (`27` + 9 national digits), which is the hard `PHONE_DIGIT_LENGTHS['27'] = { min: 11, max: 11 }` bound in `lib/phone.ts` — a shorter number would break WhatsApp identity matching.
- `formatPhoneDisplay` renders them as `+27 76 2574462` and `+27 83 8468812`, matching the reminder template's `+XX XX XXXXXXX` shape.
- Pre-checked that neither number was already stored on another profile (0 rows), so WhatsApp sender→profile linking stays unambiguous.

## Cross-references

- Accounts created in `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md` (mandane → Hope) and `.opencode/context/user-management/create-yibanathi-ntantiso-user-assign-tsgalaxy_2026-10-18.md` (yibanathi_ntantiso → TS Galaxy). The "no phone" note in those files is now superseded by this one.

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.
