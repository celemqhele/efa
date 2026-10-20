# Created user `high_chief` (+27 79 527 6855) + assigned Durban City (20 Oct)

Created a new EFA account **high_chief** with the South African mobile number `+27 79 527 6855` and the platform default password, then assigned them as manager of **Durban City** (Betway Premiership) — following the create-and-assign pattern in `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md` (account creation from `.opencode/context/user-management/create-victor-user_2026-10-14.md`, assignment through the real `assignManagerToClub()` service function).

## What was done

**1. Created the user** — new one-off script `scripts/create-high-chief-user.ts` (modelled on `scripts/create-mandane-user.ts` / `scripts/create-victor-user.ts`):

- `USERNAME = 'high_chief'` (stored lowercase with the underscore as given; email `high_chief@efa.local`).
- `PASSWORD = 'Efootball@2026'` — the shared `DEFAULT_USER_PASSWORD` from `app/api/webhook/route.ts` / `DEFAULT_PASSWORD` from `app/api/admin/reset-password/route.ts`.
- `PHONE = '27795276855'` — `+27 79 527 6855` in the app's digits-only international format (11 digits, matches `PHONE_DIGIT_LENGTHS['27']`).
- Case-insensitive duplicate guard (`ilike('username', …)`) plus a new phone-clash guard (`eq('phone', PHONE)`) — both checked clean before creation, then `auth.admin.createUser({ email_confirm: true, user_metadata: { username } })`, then profile upsert (username + phone) and verification.
- Run: `npx tsx scripts/create-high-chief-user.ts`

```
[create] auth user created: b1186864-e836-4ce7-a6d5-e9c3f4b44ecd
[create] profile: { "id": "b1186864-…", "username": "high_chief", "role": "user",
                     "phone": "27795276855", "must_change_password": true }
```

`must_change_password = true` (column default, see `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), so the first-login prompt forces a password change — and the `password_is_default()` RPC from `.opencode/context/onboarding/pre-update-default-password-sweep_2026-10-14.md` also catches them.

**2. Assigned Durban City** — new one-off script `scripts/assign-high-chief-durban-city.ts`, which resolves the profile id by username and then calls `assignManagerToClub()` from `lib/manager-mgmt.ts` directly (the exact function the admin route `app/api/admin/managers/assign/route.ts` uses), rather than hand-written SQL:

- Durban City team id `3ed9af2b-9d18-44a3-87aa-a6079fda94e8` (`south-african-premiership-2026-2027.football-logos.cc` / `durban-city`), was **vacant** (`manager_id IS NULL`), single row — no sibling club rows sharing the logo.
- Durban City held **3 unowned seats** in active tournaments (Betway Premiership, CAF Champions League, Nedbank Cup) — all `user_id IS NULL`. This is why the service function was needed: plain SQL would have set `teams.manager_id` and the tenure but left those seats managerless. The call returned `reclaimed: 3`, stamping `user_id = b1186864-…` on all three seats, and inserted audit_log `assign_manager` (`admin_id = null`, script-run).
- Open `manager_tenures` row created (`4539e3e9-f608-4e84-b67c-7276fe399729`, started `2026-10-20T06:03:49Z`).
- Run: `npx tsx scripts/assign-high-chief-durban-city.ts`

## Verification

- `teams.manager_id = b1186864-…` on Durban City; one open tenure with `manager_username = 'high_chief'`.
- All 3 `tournament_participants` seats for Durban City now carry `user_id = b1186864-…`.
- `auth.users.email_confirmed_at` is set and `encrypted_password = crypt('Efootball@2026', encrypted_password)` → `true` (exact bcrypt check, the same test as `password_is_default()`).

## Notes

- `tsx` resolved the `@/*` tsconfig path alias and the `next/headers` import chain (`lib/manager-mgmt` → `lib/slot-utils` → `lib/supabase/server`) fine from a plain script — `createAdminClient()` never calls `cookies()`, so no request context is needed.
- The two scripts are kept alongside the other one-off scripts in `scripts/`.
- This is a script-only change: no app code, no migration, so no `schema_migrations` bookkeeping was needed.

## Files

- `scripts/create-high-chief-user.ts` — one-off user-creation script.
- `scripts/assign-high-chief-durban-city.ts` — one-off assignment script.

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.
