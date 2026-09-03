# WhatsApp Welcome Menu — "Reset my password" option with phone-verified funnel

Added a **6. Reset my password** option to the WhatsApp welcome menu, plus natural-language command intercepts, backed by a deterministic phone-verified funnel that only resets the password of the account whose number is messaging — never delegated to free-form LLM output (the LLM only routes intent).

## What was done

`WELCOME_MENU` now shows `6. Reset my password`. Selecting it (or texting phrases like "reset password", "forgot password", "change password") runs a scripted YES/NO funnel in `app/api/webhook/route.ts` that resolves the caller's account by phone and, on confirmation, resets that account's password to the default via `auth.admin.updateUserById`.

## Problem solved

Users who forgot their password had no self-service path over WhatsApp (account creation at onboarding set the default password but offered no reset). A naïve approach could let a reset be applied to the wrong account, so a phone-verification gate was required — the reset may only apply to the account whose `profiles.phone` matches the number the user is messaging from.

## Fix details (all in `app/api/webhook/route.ts`)

- `SessionData` — added `password_reset_profile_id` and `password_reset_username`.
- `WELCOME_MENU` — appended `'6. Reset my password'`.
- `handleWelcomeMenu` — `num === 6` calls `handlePasswordResetStart`.
- `COMMAND_PHRASES` — added `reset_password` handler matching: "reset my password", "reset password", "forgot my password", "forgot password", "change my password", "change password", "new password".
- Text dispatch — added the `reset_password` command intercept and a `awaiting_password_reset` session-state dispatch (both mirror the onboarding flow pattern).
- `handlePasswordResetStart` — uses `resolveProfileByPhone(from)` (the same `phoneNumbersMatch` identity resolution as onboarding, see `.opencode/context/international-phone/merge-phone-whatsapp_2026-09-01.md`). No matching account → "We couldn't find an EFA account linked to this number… reply 3 to create an account." Otherwise stores `password_reset_profile_id` + `username`, sets `state='awaiting_password_reset'`, and confirms "@username… Reply YES to reset, or NO to cancel."
- `handlePasswordResetConfirm` — on NO, clears session; on YES re-verifies the phone still maps to the stored profile id, then calls `supabase.auth.admin.updateUserById(profileId, { password: DEFAULT_USER_PASSWORD })` (the same GoTrue call the admin route uses in `app/api/admin/reset-password/route.ts`), writes an `audit_log` entry (`action: 'reset_password'`), and replies with the new (default) password + login link.

**Security:** the password change is gated entirely by code — the profile must come from `resolveProfileByPhone`, and the state is re-checked on YES. The LLM conversational fallback never performs the reset itself.

## Verified

- `npx tsc --noEmit` — clean.
- `npm run lint` — only pre-existing warnings.
- `npm run build` — passes.

## Related files

- Password default + login-link constants (`DEFAULT_USER_PASSWORD`, `ONBOARDING_LOGIN_URL`) are the same ones set at onboarding in `handleOnboardingUsername` (see `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`).
- Phone identity matching is the single-field `phone` coverage from `.opencode/context/international-phone/merge-phone-whatsapp_2026-09-01.md`.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
