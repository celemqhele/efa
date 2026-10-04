# Hungry Lions manager (4gxzo) phone restored to full 11 digits

Reversed `.opencode/context/whatsapp-manager-mgmt/fix_4gxzo_phone_2026-10-03.md`: the Hungry Lions manager's number was corrected back to `27788707749` (`+27 78 870 7749`) because migration `090` had truncated an 11-digit SA mobile into an invalid 10-digit one. The user re-stated the number after the compact reminder template started printing "Their number" in the dashboard messages.

## Problem

`fix_4gxzo_phone_2026-10-03.md` (migration `090_fix_4gxzo_phone.sql`) believed `27788707749` was a digit transposition and "corrected" it to `2788707749`. That value is only **10 digits**: an SA mobile must be country code `27` + 9 national digits = 11. It fails the app's own validator (`PHONE_DIGIT_LENGTHS['27'] = { min: 11, max: 11 }` in `lib/phone.ts`), so the number could never resolve to a real WhatsApp account for the check-fixtures / onboarding flows, and it would have rendered wrong in the new reminder template's `Their number` line (see `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`).

## Fix

- New migration `supabase/migrations/095_fix_4gxzo_phone_digits.sql` (applied live):
  ```sql
  update public.profiles
  set phone = '27788707749'
  where id = '46e2d62a-a905-4447-b8f1-6c30273dbd0b'
    and phone is distinct from '27788707749';
  ```
  Written as a migration (not an ad-hoc UPDATE) so it is reproducible on a fresh/preview
  database and appears in migration history.
- Profile `46e2d62a-a905-4447-b8f1-6c30273dbd0b` = username `4gxzo`, manager of **Hungry
  Lions** (team `31ecfc55-86f4-47d6-add4-f1ff1a90ff67`).

## Verification (live)

- `profiles.phone` = `27788707749`, `length = 11`, team = Hungry Lions.
- `waDigits('27788707749')` = `27788707749` (no trunk-0 stripping; the digit after the
  country code is `7`, not `0`), and `formatPhoneDisplay` renders it `+27 78 8707749`.
- No duplicate profile holds the same digits.
- No stale `whatsapp_sessions` rows reference the old 10-digit value.

## Gotchas / Notes

- Lesson for future "phone fix" migrations: an 11-digit SA mobile whose stored form is
  10 digits is **truncation**, not transposition. `lib/phone.ts`'s
  `PHONE_DIGIT_LENGTHS` is the arbiter — check `length(phone)` against it before writing a
  "fix", and check the app's `check-fixtures` context
  (`.opencode/context/check-fixtures/contact-card-phone-fix_2026-08-15.md`,
  `.opencode/context/check-fixtures/repair-270-prefixed-phone-numbers_2026-09-29.md`)
  which documents the same class of damage.

## Cross-references

- The reverted change: `.opencode/context/whatsapp-manager-mgmt/fix_4gxzo_phone_2026-10-03.md`
  (migration `090_fix_4gxzo_phone.sql`)
- Same manager, other phone work: `.opencode/context/whatsapp-manager-mgmt/fix_andries_ourfather_phone_2026-10-03.md`
- Phone helpers/validation: `lib/phone.ts`, `.opencode/context/international-phone/country-code-dropdown_2026-09-01.md`
- Template that surfaces the number: `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |