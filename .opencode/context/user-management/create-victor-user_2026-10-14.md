# Created user VICTOR (+234 708 988 6228)

Created a new EFA account **VICTOR** with the Nigerian mobile number `+234 708 988 6228` and the platform's default password, via a new one-off script. Follows the same pattern as `.opencode/context/user-management/create-tbhotouch-user_2026-08-30.md` and `.opencode/context/user-management/create-naitor-user-and-assign-algeria_2026-08-31.md`.

## What ran

New script `scripts/create-victor-user.ts`:

- `USERNAME = 'VICTOR'` (stored uppercase), email `victor@efa.local`.
- `PASSWORD = 'Efootball@2026'` — the same `DEFAULT_USER_PASSWORD` used by WhatsApp onboarding in `app/api/webhook/route.ts` and by the admin reset route.
- `PHONE = '2347089886228'` — `+234 708 988 6228` in the app's digits-only international format (13 digits, matches `PHONE_DIGIT_LENGTHS['234']`).
- Case-insensitive duplicate guard (`ilike('username', USERNAME)`), then `auth.admin.createUser({ email_confirm: true, user_metadata: { username } })`, then updates/creates the profile row with the phone.

Run: `npx tsx scripts/create-victor-user.ts`

```
[create] auth user created: e6e79ed8-c14c-4709-861a-3acea1779451
[create] profile: { "id": "e6e79ed8-...", "username": "VICTOR", "role": "user",
                     "phone": "2347089886228", "must_change_password": true }
```

Verified: `username = 'VICTOR'`, `phone = '2347089886228'`, and `must_change_password = true` (from the new column default — see `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), so VICTOR is prompted to set a new password on first login.

`formatPhoneDisplay('2347089886228')` → `+234 70 89886228`; `waDigits` → `2347089886228`. The number parses correctly because `234` is already in `COUNTRY_CODES` (see `.opencode/context/international-phone/non-sa-number-display_2026-10-14.md`).

## Notes

- No club was assigned — this only creates the account, matching the request.
- The default password is the standard `Efootball@2026`; the first-login prompt now forces a change.
