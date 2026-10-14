# First-login forced password prompt for new accounts

New accounts now start flagged `profiles.must_change_password = true` (migration `101`) and, the first time they sign in, the app blocks them with a non-dismissible "set a new password" modal until they change it. This mirrors what the user described as the usual behaviour "when they create a password for you and when you log in for the first time a prompt pops up asking to update". Applies to every account created from now on (WhatsApp onboarding, the one-off `create-*` scripts, defensive inserts), because the flag is a column default rather than something each creation path has to remember. Related: the default password itself is `DEFAULT_USER_PASSWORD = 'Efootball@2026'` set in `app/api/webhook/route.ts` (see `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`) and the admin reset route `app/api/admin/reset-password/route.ts`; the WhatsApp reset funnel is documented in `.opencode/context/whatsapp-ux/reset-password-welcome-option_2026-09-03.md`.

## Problem

Accounts are created with a shared default password (e.g. `Efootball@2026`) that was emailed/WhatsApped to the manager, and nothing forced them to replace it — so many kept using a password every admin knows. There was no `must_change_password` / `first_login` / `temp_password` flag anywhere in the code, so there was no hook to prompt on first login.

## Fix

1. **Migration `supabase/migrations/101_profile_must_change_password.sql`** (ran via `npm run db`):
   ```sql
   ALTER TABLE public.profiles
     ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
   UPDATE public.profiles SET must_change_password = false WHERE must_change_password = true;
   ```
   `DEFAULT true` means any profile row inserted after the migration is flagged automatically (the `on_auth_user_created` trigger `handle_new_user()` inserts only `(id, username)`, so it picks up the default; the create scripts and onboarding defensive inserts do too). The `UPDATE` then clears the flag on the 96 **existing** profiles so nobody already using the app is prompted. Verified: `column_default = true`, `is_nullable = NO`, `flagged = 0 / total = 96`.

2. **Moved `ChangePasswordModal` to a shared location** — from `app/(protected)/profile/ChangePasswordModal.tsx` to `components/ui/ChangePasswordModal.tsx`, so both the profile page and the new global prompt use one implementation. Added two props:
   - `required?: boolean` — forced mode: passes `dismissible={false}` to `BottomSheet`, hides the Cancel button, and changes the copy ("Your account was created with a temporary password. Please choose your own to continue.").
   - `onSuccess?: () => void` — fired after a successful change; also, on success the modal now clears the flag itself via `supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)` (allowed by the existing `profiles_update_own` RLS policy).
   The old file was recycled (see Restore File Section) and `app/(protected)/profile/ProfileActions.tsx` now imports from `@/components/ui/ChangePasswordModal`.

3. **`components/ui/BottomSheet.tsx`** — new optional `dismissible` prop (default `true`). When `false`: no close X, and the backdrop click + Escape key are ignored. Default behaviour is unchanged for every other sheet.

4. **New `components/ui/FirstLoginPasswordPrompt.tsx`** (client) — on mount and on every Supabase `onAuthStateChange` event, reads the signed-in user's `profiles.must_change_password`; if true it renders `<ChangePasswordModal required … />` and hides itself once the change succeeds. Mounted in **`app/layout.tsx`** (root layout, next to `<GlobalNotifications />`) rather than in the `(protected)` layout, because after login users land on `/` (public home) by default and the prompt must appear there too.

## Notes / verification

- Login uses a **client-side** `signInWithPassword()` then `router.push()` (soft navigation), so the root layout does not remount — the `onAuthStateChange` subscription is what makes the prompt appear immediately after login without a refresh.
- `profiles_select_all` (SELECT true) lets the browser client read the flag; `profiles_update_own` lets it clear it. No new API route was needed.
- `must_change_password` was **not** added to `lib/supabase/types.ts` because the `profiles` entry there is already stale (missing `phone`, `theme_preferences`, `open_to_reminders`) and `createBrowserClient` is called without the `Database` generic, so column strings aren't validated. The new component casts the row (`as { must_change_password?: boolean } | null`).
- If an account was created **before** this change and still uses the default password, it is **not** flagged (deliberate: "from now on"). Resetting a password via the admin/WhatsApp route also does not re-flag it — only brand-new rows get the default `true`.
- `npx tsc --noEmit` and `eslint` clean.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `app/(protected)/profile/ChangePasswordModal.tsx` | Client modal for changing the signed-in user's password; moved to `components/ui/ChangePasswordModal.tsx` (and extended with `required` / `onSuccess`) so the global first-login prompt can reuse it | `.recycle/app-protected-profile/ChangePasswordModal.tsx_2026-10-14.tsx` |
