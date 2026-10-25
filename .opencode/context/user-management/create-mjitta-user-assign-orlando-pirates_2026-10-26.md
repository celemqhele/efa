# Created user `mjitta` + assigned Orlando Pirates (26 Oct)

Created a new EFA account **mjitta** with the platform default password and, in the same session, assigned them as manager of **Orlando Pirates** (Betway Premiership) — following the create-and-assign pattern in `.opencode/context/user-management/create-high-chief-user-assign-durban-city_2026-10-20.md` (account creation, no phone, from `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md`; assignment through the real `assignManagerToClub()` service function).

## What was done

**1. Created the user** — new one-off script `scripts/create-mjitta-user.ts` (modelled on `scripts/create-mandane-user.ts` / `.recycle/scripts/create-high-chief-user_2026-10-20.ts`):

- `USERNAME = 'mjitta'` (stored lowercase; email `mjitta@efa.local`).
- `PASSWORD = 'Efootball@2026'` — the shared `DEFAULT_USER_PASSWORD` from `app/api/webhook/route.ts` / `DEFAULT_PASSWORD` from `app/api/admin/reset-password/route.ts`.
- No mobile number was given, so `profiles.phone` is left `NULL` (same as `mandane`).
- Case-insensitive duplicate guard (`ilike('username', …)`) checked clean before creation (`SELECT … WHERE username ILIKE '%mjitta%'` → 0 rows), then `auth.admin.createUser({ email_confirm: true, user_metadata: { username } })`, then profile upsert + verification.
- Run: `npx tsx scripts/create-mjitta-user.ts`

```
[create] auth user created: 8267b3ae-7ac0-468c-b659-8ff98158b454
[create] profile: { "id": "8267b3ae-…", "username": "mjitta", "role": "user",
                     "phone": null, "must_change_password": true }
```

`must_change_password = true` (column default, see `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), so the first-login prompt forces a password change — and the `password_is_default()` RPC from `.opencode/context/onboarding/pre-update-default-password-sweep_2026-10-14.md` also catches them.

**2. Assigned Orlando Pirates** — new one-off script `scripts/assign-mjitta-orlando-pirates.ts`, which resolves the profile id by username and then calls `assignManagerToClub()` from `lib/manager-mgmt.ts` directly (the exact function the admin route `app/api/admin/managers/assign/route.ts` uses), rather than hand-written SQL:

- Orlando Pirates team id `cf637188-14aa-41ec-a87d-f9f48b30f31b` (`south-african-premiership-2026-2027.football-logos.cc` / `orlando-pirates`), was **vacant** (`manager_id IS NULL`), single row — no sibling club rows sharing the logo. (`Boipatong Young Pirates` in `abc-motsepe-league-2026-2027` is a separate club and was correctly left untouched.)
- Orlando Pirates held **3 unowned seats** in active tournaments (Betway Premiership, CAF Champions League, Nedbank Cup) — all `user_id IS NULL`. This is why the service function was needed: plain SQL would have set `teams.manager_id` and the tenure but left those seats managerless. The call returned `reclaimed: 3`, stamping `user_id = 8267b3ae-…` on all three seats, and inserted audit_log `assign_manager` (`admin_id = null`, script-run).
- Open `manager_tenures` row created (`a71fa4ae-26f0-4f3e-b965-9cbe6ecdaf29`, started `2026-10-25T22:05:47Z` = 26 Oct 00:05 SAST).
- Run: `npx tsx scripts/assign-mjitta-orlando-pirates.ts`

## Verification

- `teams.manager_id = 8267b3ae-…` on Orlando Pirates; one open tenure with `manager_username = 'mjitta'`.
- All 3 `tournament_participants` seats for Orlando Pirates now carry `user_id = 8267b3ae-…`.
- `auth.users.email_confirmed_at` is set and `encrypted_password = crypt('Efootball@2026', encrypted_password)` → `true` (exact bcrypt check, the same test as `password_is_default()`).
- One pre-existing non-forfeit result remains on a `confirmed_pending` fixture (4-6, `finalised_by` a real user) — not an auto-forfeit, so nothing needed withdrawing; the assignment reported no forfeit handling because the club was never managerless mid-season.

## Notes

- `tsx` resolved the `@/*` tsconfig path alias and the `next/headers` import chain (`lib/manager-mgmt` → `lib/slot-utils` → `lib/supabase/server`) fine from a plain script — `createAdminClient()` never calls `cookies()`, so no request context is needed.
- This is a script-only change: no app code, no migration, so no `schema_migrations` bookkeeping was needed.

## Files

- `scripts/create-mjitta-user.ts` — one-off user-creation script.
- `scripts/assign-mjitta-orlando-pirates.ts` — one-off assignment script.

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change (same choice as `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md`).
