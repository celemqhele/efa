# Backfilled `mjitta` phone number (+27 66 516 6836) (26 Oct)

Added the South African mobile number `+27 66 516 6836` to the `mjitta` profile created earlier in `.opencode/context/user-management/create-mjitta-user-assign-orlando-pirates_2026-10-26.md`. After that change the user reported the missing number, so the account had been created with `profiles.phone = NULL` (the same no-phone shape as `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md`); this file records the follow-up backfill.

## What was done

- Stored as digits-only international format `27665166836` (11 digits — matches `PHONE_DIGIT_LENGTHS['27']` used by the international-phone helpers, see `.opencode/context/international-phone/support_2026-08-26.md`).
- Clash check first: `SELECT id, username, phone FROM profiles WHERE phone = '27665166836' OR phone ILIKE '%665166836%'` → 0 rows, so no other profile/manager owns the number.
- Single-row update via `npm run db`:

```sql
UPDATE profiles SET phone = '27665166836' WHERE username = 'mjitta'
RETURNING id, username, phone, must_change_password;
```

```
8267b3ae-7ac0-468c-b659-8ff98158b454 | mjitta | 27665166836 | true
```

## Verification

- `profiles.phone = '27665166836'` on `8267b3ae-…` (`mjitta`); still exactly one row.
- `must_change_password` still `true`, so the first-login password prompt from `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md` is unaffected.
- Orlando Pirates assignment from `.opencode/context/user-management/create-mjitta-user-assign-orlando-pirates_2026-10-26.md` is untouched (club binding and the 3 reclaimed seats hang off the profile id, not the phone).

## Notes

- `teams.whatsapp_number` was deliberately left alone: only 22 of 141 `teams` rows carry it and no app code reads that column (grep for `whatsapp_number` across `app/` and `lib/` returns nothing), so `profiles.phone` is the single source for WhatsApp/manager lookup — same as the other one-off creations in this folder.
- No files changed and nothing moved to `.recycle/`.
