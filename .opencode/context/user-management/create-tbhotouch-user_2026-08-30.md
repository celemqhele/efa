# Create EFA user "TbhoTouch"

**Date:** 2026-08-30

Created a new EFA user with username `TbhoTouch`, the default platform password
(`Efootball@2026`), and the mobile number `+27 73 182 6775`.

## What was done

A one-off script (`scripts/create-tbhotouch-user.ts`) used the Supabase admin
API (`supabase.auth.admin.createUser`) — the same path the WhatsApp onboarding
flow uses — to:

- Create the auth user with username normalized to lowercase `tbhotouch`,
  email `tbhotouch@efa.local`, password `Efootball@2026`, `email_confirm: true`.
- Store the profile row (auto-created by the `on_auth_user_created` trigger)
  with `username = tbhotouch`, `whatsapp_number = +27731826775` (international
  format, matching how the WhatsApp webhook stores numbers), and
  `phone = +27 73 182 6775`.
- Verified both `auth.users` (email confirmed) and `profiles` rows.

Auth user id: `d692dd4f-0a04-4ee6-95eb-c0369af7a6c1`.

## Notes

- The default password `Efootball@2026` is defined in
  `app/api/webhook/route.ts` (`DEFAULT_USER_PASSWORD`) and
  `app/api/admin/reset-password/route.ts` (`DEFAULT_PASSWORD`).
- Usernames are stored lowercase per the webhook convention
  (`username.toLowerCase()` in `handleOnboardingUsername`).
- `whatsapp_number` is stored in international format (`+27731826775`) matching
  the rest of the platform; the human-readable form `+27 73 182 6775` is kept
  in the `phone` column.

## Run

```bash
npx tsx scripts/create-tbhotouch-user.ts
```

(The script derives the Supabase URL from `SUPABASE_DB_URL` and uses
`SUPABASE_SERVICE_ROLE_KEY` from `.env.local`.)
