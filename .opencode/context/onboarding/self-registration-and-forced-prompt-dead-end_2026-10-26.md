# Self-registration no longer forces a password change, and the forced prompt can no longer dead-end

Fixes the "Current password is incorrect" loop users hit on first login: self-registered accounts were stamped `must_change_password = true` even though they chose their own password at sign-up, and the forced prompt made the *current* password mandatory, so anyone whose password was not the platform default had no way past the sheet. Reported by the user as "it keeps saying Current password is incorrect, even when we use Efootball@2026" right after the 2026-10-26 account creations in `.opencode/context/user-management/create-nyanda-maskandi-users-assign-nwu-siwelele_2026-10-26.md`.

## Problem

Two separate defects combined into a hard dead end.

1. **Self-registration was flagged as a temporary-password account.**
   `app/(auth)/register/_mobile.tsx` (and `_desktop.tsx`) call `supabase.auth.signUp()` with the password the user just typed, then insert the `profiles` row with only `{ id, username }`. `profiles.must_change_password` has a column default of `true` (migration `101`, see `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), so every self-registered account immediately got the blocking "Your account was created with a temporary password" sheet — while its real password was the one the user had chosen, not `Efootball@2026`. Verified on real data: `mdunge` was created at `2026-10-25T22:21:43Z` (auth) / `22:21:44` (profile, i.e. from the register page), flagged `true`, but `crypt('Efootball@2026', encrypted_password)` was **false**.

2. **The forced prompt required the current password.**
   `ChangePasswordModal` verified the old password with a re-`signInWithPassword()` before calling `updateUser({ password })`. For a flagged-but-not-default account the only "current password" anyone could supply was the default they were told about, which is wrong — so every attempt returned `Invalid login credentials` and the modal reported "Current password is incorrect." with no escape (the sheet is non-dismissible in `required` mode). All non-credential errors (rate limit, network) were also mislabelled as a wrong password, hiding the real cause.

A third, smaller issue: after a successful change the stale auth-event check could re-open the prompt. `FirstLoginPasswordPrompt` re-ran `check()` on every `onAuthStateChange` event, so the `USER_UPDATED` fired by the password update raced the `profiles` flag clear and re-read `must_change_password = true` from just before the write.

## Fix

- `app/(auth)/register/_mobile.tsx`, `app/(auth)/register/_desktop.tsx`: write the profile with `must_change_password: false` via `upsert` (also safe if a trigger ever creates the row first), because the sign-up password is the user's own choice.
- `components/ui/ChangePasswordModal.tsx`:
  - new `skipCurrentPassword` prop. When set, the current-password field is not rendered and no re-sign-in happens — `updateUser({ password })` only needs the session the user already has. The profile-page flow (`ProfileActions`) still verifies the old password.
  - verification retries once with the value `trim()`med (mobile keyboards append a trailing space), and only maps `invalid login credentials` to the friendly message; any other error (rate limit, network) is shown as-is.
  - a failed `must_change_password` clear is logged instead of failing silently, and does not block the success state (the password did change).
  - inputs gained `autoComplete="current-password"` / `"new-password"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` so phone keyboards and Chrome's password manager stop mangling the fields.
- `components/ui/FirstLoginPasswordPrompt.tsx`: passes `skipCurrentPassword`; only `SIGNED_IN` / `INITIAL_SESSION` trigger `check()` (`USER_UPDATED` no longer re-reads the pre-change flag); a `clearedAt` ref ignores any check that resolves within 10s of a successful change, so the sheet cannot flash back open.
- Data fix, same session: `UPDATE profiles ... SET must_change_password = false` for rows that were flagged `true` while their password was **not** the default. Exactly one account matched (`mdunge`), who was then unblocked immediately rather than waiting for the deploy.

## Verification

- `npx tsc --noEmit` clean; `npx eslint` on the four touched files: no new problems (only the pre-existing unused `data`/`router` warnings in the register components).
- Browser run against `localhost:3000`, throwaway user `probe_tmp_1026` (default password + flag set): the forced sheet rendered **two** password fields (new + confirm, no current-password label), `PUT /auth/v1/user` returned 200, `PATCH /profiles` returned 204, the prompt disappeared without a reload, and the DB showed the new password and `must_change_password = false`.
- Browser run of the real `/register` form with a fresh `probe_reg_1026` and a self-chosen password: landed on `/profile` with **no** forced prompt, and the profile row was written with `must_change_password = false`.
- Both throwaway users and the temporary diagnostic scripts were removed afterwards; nothing test-related is left in the database.

## Restore File Section

Temporary diagnostics created and then moved to `.recycle` (not deleted):

| Original path | Purpose | New path |
| --- | --- | --- |
| `scripts/_tmp-check-password-grant_2026-10-26.ts` | password grant (GoTrue `/token`) probe across accounts | `.recycle/scripts/_tmp-check-password-grant_2026-10-26.ts` |
| `scripts/_tmp-probe-user_2026-10-26.ts` | create/delete a throwaway auth user for browser tests | `.recycle/scripts/_tmp-probe-user_2026-10-26.ts` |
| `scripts/_tmp-replay-modal_2026-10-26.ts` | replay the modal's sign-in → updateUser sequence with supabase-js | `.recycle/scripts/_tmp-replay-modal_2026-10-26.ts` |
| `scripts/_tmp-reset-probe_2026-10-26.ts` | reset the probe account to default password + flag | `.recycle/scripts/_tmp-reset-probe_2026-10-26.ts` |
| `scripts/_tmp-session-shape_2026-10-26.ts` | inspect the session/user shape returned by password sign-in | `.recycle/scripts/_tmp-session-shape_2026-10-26.ts` |
| `.playwright-mcp/` | Playwright MCP snapshots/console logs from the reproduction | `.recycle/playwright-mcp_2026-10-26/` |
