# goat_2 truncated phone number — data fix + validation + audit

Corrected `goat_2`'s phone on the live DB from the truncated `2766558283` to the real WhatsApp number `27665582832`, then hardened all phone-write paths with length validation (server reject + input clamps) and an `audit_log` trail, so a mistyped/truncated number can never be stored silently again. This is a follow-up to the earlier one-off number correction in `.opencode/context/fixes/parmalat-phone-number_2026-09-08.md` — that fix reprinted the wrong number with no guard, and this one adds the guard plus traceability.

## Problem

The player `goat_2` (id `89388e8a-1cb3-4784-9c68-37c06cbf318a`, manages **France**) reported that WhatsApp commands replied "user not found" even though they had updated their phone.

Supabase forensics (Vercel logs were unreachable — free-plan 1-hour retention and the update happened earlier):

- `profiles.phone` = `2766558283` — **10 digits**, one digit short of the real `+27 66 558 2832` = `27665582832`.
- The real WhatsApp `from` is provably `27665582832`: today's backdoor submission (Netherlands vs France, fixture `c3a09641-0362-4bf9-8aa5-e3ac31570233`) recorded `backdoor_submissions.submitter_phone = '27665582832'` at `2026-09-10 14:08Z`.
- Every webhook phone-write stores `msg.from` **verbatim** (`handlePhoneUpdate`/`handlePhoneTeamConfirm`/`handleFixturesPhoneConfirm`/onboarding in `app/api/webhook/route.ts` at lines ~1063, ~1111, ~1293, ~2148), and `from` is `27665582832`, so the bot did NOT write this value.
- The value `2766558283` = `27` + `66558283` — an 8-digit local part (missing the trailing `2`) typed into a **free-text web input** (`app/api/profile/update/route.ts` / `app/api/admin/managers/set-phone/route.ts` → `toStoredPhone('27','66558283')`). No `audit_log` entry exists for it (only a 09-03 `reset_password`), confirming it was an unlogged manual entry.

Why "user not found": `phoneNumbersMatch('2766558283','27665582832')` (`app/api/webhook/route.ts:973`) returns `false` (unequal; neither is `0`-prefixed so the local↔intl mapping never applies), so `resolveProfileByPhone` and the check-fixtures/phone-update detection cannot find goat_2.

Why it was not formatted correctly: no validation existed at any write point — `lib/phone.ts:toStoredPhone` strips a leading `0` and joins cc+local with **no length check**; `waDigits` (both server routes) only prepends `27` to `0`-prefixed locals and passes a short `27…` number through unchanged; the web inputs had no `maxLength`/pattern.

## Fix

1. **Data fix (live DB, run via `npm run db`)**
   ```sql
   UPDATE profiles SET phone = '27665582832' WHERE id = '89388e8a-1cb3-4784-9c68-37c06cbf318a';
   ```
   Verified after: profile now reports `27665582832`.

2. **Validation — `lib/phone.ts` (new)**
   - `PHONE_DIGIT_LENGTHS`: per-country-code total digit ranges (SA `27` = exactly 11; also `44`, `1`, `233`, `234`, `264`, `353`, `31`, `49`, `389`), calibrated against the live DB (11 = `276/277/278/389`, 12 = `233/264/270`, 13 = `234`).
   - `phoneDigitLengthBounds(countryCode)` — range lookup (unknown codes fall back to 7-15).
   - `phoneLocalMaxLength(countryCode)` — max digits for the local-part input (= range max minus cc digits; SA = 9).
   - `isValidStoredPhone(phone)` — accepts only digits-only international numbers within the matching code's range; rejects truncated numbers like `2766558283`.

3. **Server reject (400) — `app/api/admin/managers/set-phone/route.ts` and `app/api/profile/update/route.ts`**
   - Both now run the cleaned number (`waDigits`) through `isValidStoredPhone` and return `Invalid phone number — check you have the full number with the country code.` instead of silently storing a truncated one.

4. **Input clamps — `app/(protected)/profile/_mobile.tsx`, `_desktop.tsx`, `app/(admin)/admin/users/manage/ManagersClient.tsx`**
   - Phone local-part inputs are now digit-only with `maxLength={phoneLocalMaxLength(countryCode)}`, so a too-short number can't be typed in the first place.
   - Profile pages now surface the server's `400` message (`phoneError`) instead of failing silently.

5. **Audit trail — `audit_log` writes**
   - `set-phone` inserts `action: 'update_phone'`, `target_type: 'profile'`, `target_id: user_id`, `admin_id`, with `previous_phone` + `phone` in details.
   - `profile/update` inserts the same with `admin_id: null` (self-update via profile page). DB column `admin_id` is nullable (`information_schema` confirmed), generated TS type is stricter but both writers use the existing `(adminSupabase as any)` pattern used elsewhere.

## Verification

- `npm run db` — UPDATE confirmed 1 row; re-query shows `27665582832`.
- `npx tsc --noEmit` — clean.
- `npm run lint` — only pre-existing warnings unrelated to these files.

## Context chain (by path)

- One-off number correction pattern: `.opencode/context/fixes/parmalat-phone-number_2026-09-08.md`
- Single phone field + `waDigits`/`canonicalPhone` lineage: `.opencode/context/international-phone/merge-phone-whatsapp_2026-09-01.md` and `.opencode/context/international-phone/country-code-dropdown_2026-09-01.md`
- WhatsApp phone-update flows these guards protect: `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md` and `.opencode/context/check-fixtures/phone-update-no-decline-fix_2026-08-30.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |