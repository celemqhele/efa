# Reminder template no longer forces +27 on non-SA numbers

Fixed the WhatsApp reminder template so a manager's number with a country code the app didn't know is no longer relabelled as South African. The user reported that "the whatsapp template for non +27 numbers has not been updated" and that Venda FC's number "is appearing weird" and "forces a +27 extension" when the template message is opened. Follows the phone parsing introduced in `.opencode/context/international-phone/country-code-dropdown_2026-09-01.md` and the SA-length guard in `.opencode/context/user-management/fix-4gxzo-phone-11-digits_2026-10-04.md`.

## Problem

The manager-reminder template (built in `components/ui/DashboardFixtureActions.tsx` and its siblings, using `formatPhoneDisplay` from `lib/phone.ts`) printed the opponent's number. For Venda FC manager `suab` the stored phone is `8801855436525` — a Bangladesh number (`+880`). Because `880` was **not** in `COUNTRY_CODES`, `parsePhoneParts()` hit its final fallback:

```ts
return { countryCode: DEFAULT_COUNTRY_CODE, local: digits } // DEFAULT_COUNTRY_CODE = '27'
```

so the template rendered `+27 88 01855436525` — a "weird", wrong number with a forced `+27`. Opening the template in WhatsApp then tried to dial a nonexistent SA number.

Secondary bug: the profile phone editor's `<select>` is built from `COUNTRY_CODES`. When `parsePhoneParts` returned `27` for that number, the form showed `+27` selected with the whole 13-digit string in the local input; saving without touching the dropdown would have stored `278801855436525`, corrupting the number.

`8801855436525` was the only non-listed code in production (all other international numbers use `233`, `234`, `264`, or `389`, which are in the list).

## Fix

All in `lib/phone.ts`:

1. **Added Bangladesh to the known codes** — `{ code: '880', label: '+880 Bangladesh' }` in `COUNTRY_CODES`, plus `'880': { min: 13, max: 13 }` in `PHONE_DIGIT_LENGTHS` so the 13-digit number validates and the profile dropdown can represent it.
2. **Stopped inventing `+27`** — `parsePhoneParts()` now returns `{ countryCode: '', local: digits }` when the prefix matches no known country code and the number is not a 10-digit local SA number. It hands the already-international digit string back untouched instead of lying about the country.
3. **`formatPhoneDisplay()`** — handles the empty country code by returning `` `+${local}` `` (the real international digits) rather than an empty string or a bogus `+27`.

Round-trip verified with `tsx`:

| Stored | Display | wa.me digits |
|---|---|---|
| `8801855436525` (Venda FC) | `+880 18 55436525` | `8801855436525` |
| `2347089886228` (VICTOR) | `+234 70 89886228` | `2347089886228` |
| `27633148937` | `+27 63 3148937` | `27633148937` |
| `+27 79 811 5750` | `+27 79 8115750` | `27798115750` |
| `0674008857` (local SA) | `+27 67 4008857` | `27674008857` |

`npx tsc --noEmit` and `eslint` clean.

## Notes

- The same `formatPhoneDisplay` output is used by the compact reminder template documented in `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`, so the fix corrects every surface that prints a manager's number (dashboard reminder links, manager cards).
- Only known codes should be added to `COUNTRY_CODES` as they appear in real data; unknown codes now degrade to a truthful `+<digits>` instead of a base-country guess.
