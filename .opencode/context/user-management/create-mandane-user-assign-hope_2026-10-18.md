# Created user `mandane` + assigned to Hope (18 Oct)

Created a new EFA account **mandane** with the platform default password and, in the same session, assigned them as manager of the **Hope** club (Motsepe Foundation Championship) — following the account-creation pattern in `.opencode/context/user-management/create-victor-user_2026-10-14.md` and the create-and-assign pattern in `.opencode/context/user-management/create-naitor-user-and-assign-algeria_2026-08-31.md`, but running the assignment through the real service function instead of hand-written SQL.

## What was done

**1. Created the user** — new one-off script `scripts/create-mandane-user.ts` (modelled on `scripts/create-victor-user.ts`):

- `USERNAME = 'mandane'` (stored lowercase — the dominant casing in `profiles`: 86 of 97 rows are lowercase), email `mandane@efa.local`.
- `PASSWORD = 'Efootball@2026'` — the shared `DEFAULT_USER_PASSWORD` from `app/api/webhook/route.ts` / `DEFAULT_PASSWORD` from `app/api/admin/reset-password/route.ts`.
- No mobile number was given, so `profiles.phone` is left `NULL`.
- Case-insensitive duplicate guard (`ilike('username', …)` — both `mandane` and existing rows checked clean before creation), then `auth.admin.createUser({ email_confirm: true, user_metadata: { username } })`, then profile upsert + verification.
- Run: `npx tsx scripts/create-mandane-user.ts`

```
[create] auth user created: 6a97a4e2-6312-4689-9beb-35a1c07a8af4
[create] profile: { "id": "6a97a4e2-…", "username": "mandane", "role": "user",
                     "phone": null, "must_change_password": true }
```

`must_change_password = true` (column default, see `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), so the first-login prompt forces a password change — and the `password_is_default()` RPC from `.opencode/context/onboarding/pre-update-default-password-sweep_2026-10-14.md` also catches them.

**2. Assigned Hope** — new one-off script `scripts/assign-mandane-hope.ts`, which calls `assignManagerToClub()` from `lib/manager-mgmt.ts` directly (the exact function the admin route `app/api/admin/managers/assign/route.ts` uses) rather than the SQL-file approach used for NAITOR:

- Hope team id `69f95372-9c41-4755-82ee-a368912e4a83` (`motsepe-foundation-championship-2026-2027.football-logos.cc` / `hope`), was **vacant** (`manager_id IS NULL`), single row — no sibling club rows sharing the logo.
- Hope held **3 unowned seats** in active tournaments (Motsepe Foundation Championship, CAF Confederations League, Nedbank Cup) — all `user_id IS NULL`. This is why the service function was needed: plain SQL would have set `teams.manager_id` and the tenure but left those seats managerless. The call returned `reclaimed: 3`, stamping `user_id = mandane` on all three seats, and inserted audit_log `assign_manager` (`admin_id = null`, script-run).
- Open `manager_tenures` row created (`5c974c7e-0d89-4057-8199-3cb49a7c1560`, started `2026-10-18T14:48:50Z`).
- Run: `npx tsx scripts/assign-mandane-hope.ts`

## Verification

- `teams.manager_id = 6a97a4e2-…` on Hope; one open tenure with `manager_username = 'mandane'`.
- All 3 `tournament_participants` seats for Hope now carry `user_id = 6a97a4e2-…`.
- `auth.users.encrypted_password = crypt('Efootball@2026', encrypted_password)` → `true` (exact bcrypt check, the same test as `password_is_default()`).
- 6 pre-existing `Managerless club absent — automatic …` results remain on **confirmed** Motsepe fixtures — `clearAutoForfeitResults()` only withdraws auto-forfeits from fixtures still in `scheduled` / `awaiting_confirmation` / `confirmed_pending`, so played-and-confirmed history is intentionally untouched (no pending fixture had one).

## Notes

- `tsx` resolved the `@/*` tsconfig path alias and the `next/headers` import chain (`lib/manager-mgmt` → `lib/slot-utils` → `lib/supabase/server`) fine from a plain script — `createAdminClient()` never calls `cookies()`, so no request context is needed. Future one-off scripts can reuse app service functions directly.
- The two scripts are kept alongside the other one-off scripts in `scripts/`.

## Files

- `scripts/create-mandane-user.ts` — one-off user-creation script.
- `scripts/assign-mandane-hope.ts` — one-off assignment script.

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.
