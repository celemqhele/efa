# Merge whatsapp_number into phone — single phone field

**Date:** 2026-09-01

The `profiles` table carried two equivalent phone fields — `phone` (user-set) and `whatsapp_number` (admin-set / auto-set during onboarding). Both were used for WhatsApp contact and identity matching, causing the admin dashboard "Fixtures Due" WhatsApp button to be missing for managers who only had `phone` set (and vice versa). They were unified into a single `phone` column and all code was migrated to it.

## Problem

Managers could have their number in either `profiles.phone` or `profiles.whatsapp_number` depending on how it was set (profile page vs admin managers page vs WhatsApp onboarding vs bot auto-update). Reads of the two fields were inconsistent:

- Admin dashboard due-fixtures embed (`app/(admin)/admin/dashboard/page.tsx`) selected only `whatsapp_number` — so fixtures whose managers only had `phone` set showed **no WhatsApp chat button** (the H/A buttons in DashboardFixtureActions are rendered only when the phone prop is truthy).
- Webhook identity resolution (`.opencode/context/international-phone/support_2026-08-26.md` context, `app/api/webhook/route.ts`) checked both fields in most places (`phoneNumbersMatch(a.whatsapp_number, from) || phoneNumbersMatch(a.phone, from)`), but the "check fixtures" flow checked only `phone`.
- `whatsapp_number` was never added via a committed migration — it existed only on the live remote DB, while `phone` was added in `supabase/migrations/032_add_profile_phone.sql`.

## Fix

### Database — `supabase/migrations/068_merge_phone_whatsapp.sql` (new, applied via `npm run db`)
1. `UPDATE profiles SET phone = whatsapp_number WHERE phone IS NULL AND whatsapp_number IS NOT NULL;` — survivor keeps existing `phone` values, fills the gap from `whatsapp_number`.
2. `ALTER TABLE public.profiles DROP COLUMN IF EXISTS whatsapp_number;`

Verified after apply: only `phone` remains in `information_schema.columns`; 55/82 profiles have a non-null `phone`.

### Code — all `whatsapp_number` reads/writes migrated to `phone`

- `app/api/webhook/route.ts` — removed `whatsapp_number` from the identity-`, message-`, and admin-lookup selects; dropped the `|| phoneNumbersMatch(p.whatsapp_number, from)` branches at onboarding (line ~2057), `resolveProfileByPhone` (~2162), and `getAdminProfileIdByPhone` (~2647); onboarding insert/update now writes `phone: from` (~2132/2134); opponent contact card select now only fetches `phone` and `const phoneRaw = manager?.phone || null` (~1309/1331).
- `app/(admin)/admin/dashboard/page.tsx` (lines 60-61) — due-fixtures embed now selects `phone` instead of `whatsapp_number`. This is the fix for the missing H/A WhatsApp buttons.
- `app/(admin)/admin/dashboard/_mobile.tsx` / `_desktop.tsx` — pass `fx.home_team?.manager?.phone` / `fx.away_team?.manager?.phone` into `DashboardFixtureActions`.
- `app/(admin)/admin/managers/page.tsx` — profiles query selects `phone`.
- `app/(admin)/admin/managers/ManagersClient.tsx` — `Profile` interface field, `hasWa` check, WhatsApp button `phone` prop, and edit-dialog read now use `phone`; UI labels changed to "Phone number" / "+ Add phone number".
- `app/api/admin/managers/set-whatsapp/route.ts` → **replaced** by `app/api/admin/managers/set-phone/route.ts` (accepts `phone`, updates `profiles.phone`); old route moved to `.recycle/api-admin-managers/set-whatsapp/route.ts`. The admin managers UI (ManagersClient.tsx) now calls `/api/admin/managers/set-phone`.
- `scripts/create-tbhotouch-user.ts` — insert/update/verify use only `phone` (drops `whatsapp_number`).

### Unchanged (already used `phone` only)
- `app/api/profile/update/route.ts`, `app/(protected)/profile/_mobile.tsx` / `_desktop.tsx`
- `app/(public)/teams/[id]/_mobile.tsx` / `_desktop.tsx` (MessageManagerButton)
- `app/(admin)/admin/export/page.tsx`
- `backdoor_submissions.submitter_phone` and `lib/whatsapp.ts` contact phone are unrelated (kept as-is).

## Verification
- `npx tsc --noEmit` — clean.
- `npm run lint` — only pre-existing warnings unrelated to this change.

## Related files
- `.opencode/context/international-phone/support_2026-08-26.md` — covers the `toInternationalPhone` / `phoneNumbersMatch` utilities that operate on these fields; this file supersedes the two-field duality those utilities handled.
- `.opencode/context/check-fixtures/contact-card-phone-fix_2026-08-15.md` — the `phone || whatsapp_number` fallback origin, now a single-field read.
- `.opencode/context/user-management/create-tbhotouch-user_2026-08-30.md` — script touched here used both fields.

## Restore File Section
- Original path: `app/api/admin/managers/set-whatsapp/route.ts`
- Purpose: admin endpoint to set a manager's WhatsApp number
- New path: `.recycle/api-admin-managers/set-whatsapp/route.ts` (replaced by `app/api/admin/managers/set-phone/route.ts`)