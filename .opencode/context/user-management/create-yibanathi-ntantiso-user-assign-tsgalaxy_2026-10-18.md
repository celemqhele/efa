# Created user `yibanathi_ntantiso` + assigned to TS Galaxy (18 Oct)

Created a new EFA account **yibanathi_ntantiso** with the platform default password and assigned them as manager of **TS Galaxy** (Betway Premiership / South African Premiership logo folder), the same day as — and following the exact pattern established in — `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md`.

## What was done

**1. Created the user** — new one-off script `scripts/create-yibanathi-ntantiso-user.ts` (copy of `scripts/create-mandane-user.ts` with the constants swapped):

- `USERNAME = 'yibanathi_ntantiso'` (lowercase, underscore is fine in `profiles.username`), email `yibanathi_ntantiso@efa.local`.
- `PASSWORD = 'Efootball@2026'` — the shared `DEFAULT_USER_PASSWORD` (`app/api/webhook/route.ts`) / `DEFAULT_PASSWORD` (`app/api/admin/reset-password/route.ts`).
- No mobile number given, so `profiles.phone` stays `NULL`.
- Case-insensitive duplicate guard on `username` + clean `auth.users` email check (both empty before creation), then `auth.admin.createUser({ email_confirm: true, user_metadata: { username } })`, profile upsert, verification.
- Run: `npx tsx scripts/create-yibanathi-ntantiso-user.ts`

```
[create] auth user created: 7820ba90-2d0c-44b0-8fb7-400d09505765
[create] profile: { "id": "7820ba90-…", "username": "yibanathi_ntantiso", "role": "user",
                     "phone": null, "must_change_password": true }
```

`must_change_password = true` (column default — `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), and the `password_is_default()` RPC (`.opencode/context/onboarding/pre-update-default-password-sweep_2026-10-14.md`) independently covers the default password.

**2. Assigned TS Galaxy** — new one-off script `scripts/assign-yibanathi-ntantiso-tsgalaxy.ts`, which calls `assignManagerToClub()` from `lib/manager-mgmt.ts` (the function behind `app/api/admin/managers/assign/route.ts`).

- TS Galaxy team id `4d2954c3-c204-4ddf-abde-8c6e8a831395` (`south-african-premiership-2026-2027.football-logos.cc` / `ts-galaxy`), was **vacant** (`manager_id IS NULL`), single row — no sibling club rows.
- It held **3 unowned seats** in active tournaments (Betway Premiership, CAF Champions League, Nedbank Cup), all `user_id IS NULL`. The service function reclaimed all three (`reclaimed: 3`) so the club is not left managerless at slot level, and wrote an audit_log `assign_manager` row (`admin_id = null`, script-run).
- Unlike the mandane script, the user id is passed as `argv[2]` (`npx tsx scripts/assign-yibanathi-ntantiso-tsgalaxy.ts 7820ba90-…`) so the assign script never needs editing when reused; it validates the uuid shape and hard-fails unless every TS Galaxy seat carries the new `user_id`.
- Open `manager_tenures` row created (`aa1592da-0b21-4586-8ce6-22b1a994447c`, started `2026-10-18T15:27:32Z`).

## Verification

- `teams.manager_id = 7820ba90-…` on TS Galaxy; one open tenure with `manager_username = 'yibanathi_ntantiso'`.
- All 3 `tournament_participants` seats for TS Galaxy now carry `user_id = 7820ba90-…` (script asserts this and exits non-zero otherwise).
- `auth.users.encrypted_password = crypt('Efootball@2026', encrypted_password)` → `true`.

## Notes

- No auto-forfeit withdrawal question arose: the script only restores `scheduled` / `awaiting_confirmation` / `confirmed_pending` fixtures; confirmed history is left as-is (same rule noted in `.opencode/context/user-management/create-mandane-user-assign-hope_2026-10-18.md`).
- Reusable pair for future "create user + give them a club" requests: a `create-*-user.ts` copy plus an assign script that takes the user id on the command line.

## Files

- `scripts/create-yibanathi-ntantiso-user.ts` — one-off user-creation script.
- `scripts/assign-yibanathi-ntantiso-tsgalaxy.ts` — one-off assignment script (user id via argv).

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.
