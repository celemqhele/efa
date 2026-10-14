# Catch pre-update accounts still on the default password

Follow-up to `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`: after that shipped, the user asked to also catch people who still have the default password from **before** the update and who had already logged in before (the `must_change_password` column default only flagged accounts created afterwards). Migration `102` adds an exact `password_is_default()` RPC that the first-login prompt consults on every login, plus a one-off sweep that flags the 21 pre-update accounts that had logged in and were still on the default.

## Problem

The migration-101 flag is set by the `profiles.must_change_password` **column default**, so it only stamps rows inserted *after* the migration. Two groups slipped through:

- Accounts created before the update (their flag was deliberately set back to `false` so existing users weren't nagged).
- Accounts whose password is reset back to the default via the admin route (`app/api/admin/reset-password/route.ts`) or the WhatsApp reset funnel (`app/api/webhook/route.ts`) — those rows already exist, so the default never applies.

The shared default is `Efootball@2026` (`DEFAULT_USER_PASSWORD` in `app/api/webhook/route.ts`). Nobody should be able to keep using it.

## Fix

GoTrue stores bcrypt hashes in `auth.users.encrypted_password`, so `encrypted_password = crypt('Efootball@2026', encrypted_password)` is an exact, salt-independent "is the password still the default?" test — no need to try signing in. New migration `supabase/migrations/102_password_is_default_rpc.sql`:

1. **`public.password_is_default()`** — a `STABLE SECURITY DEFINER` SQL function returning `true` when the **caller's** password is still the default. It uses `auth.uid()` (not a parameter) so a user can only ever probe their own password, and an anonymous caller (`auth.uid()` is null) always gets `false`. `search_path` is pinned to `public, extensions, auth` and `crypt` is called as `extensions.crypt(...)`. `GRANT EXECUTE … TO authenticated, service_role`.
2. **Immediate sweep** — flags (`must_change_password = true`) the pre-update accounts that `last_sign_in_at IS NOT NULL` and are still on the default. On prod this flagged exactly **21** profiles; a fresh database has no `auth.users` rows so it is a no-op.

`components/ui/FirstLoginPasswordPrompt.tsx` now prompts when `must_change_password` is true **OR** `supabase.rpc('password_is_default')` returns true. If the RPC is unavailable (migration not applied yet) the call just errors and the flag path still works, so the prompt degrades gracefully.

## Verification

- `extensions.crypt` compare over `auth.users`: 26 accounts still on the default before the sweep; 21 of them had logged in before AND are now flagged; the 5 that had never logged in were intentionally left unflagged (per the "have logged in before" request) but are still covered by the RPC on their first login.
- RPC tested by simulating `request.jwt.claims` via `set_config`: `suab` (default) → `true`, `celemqhele` (changed) → `false`, anonymous → `false`.
- `npx tsc --noEmit`, `eslint`, and `npm run build` clean.

## Notes

- VICTOR (created in `.opencode/context/user-management/create-victor-user_2026-10-14.md`) had already logged in and changed his password before this ran, so he is no longer on the default and was not swept — the prompt worked end-to-end on him.
- The `password_is_default()` check hardcodes `Efootball@2026`. If the default ever changes, update this function too (alongside `DEFAULT_USER_PASSWORD` in the webhook and `DEFAULT_PASSWORD` in the admin reset route).
- `crypt()` is bcrypt at cost 10, so the prompt costs ~50–100 ms of DB time once per login. Acceptable.
- Known limitation (accepted): the RPC is only meaningful for accounts that can sign in; there is no way to detect a default password for accounts with no `auth.users` row (placeholder profiles).

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.
