# User account JD_501 created + assigned to Supersport

Created 2026-10-26. User requested: username `jd_501`, club `Supersport`, phone `+27 66 236 5822` (stored as `27662365822`), default password `Efootball@2026`, treated as temp/default account (`must_change_password = true`).

## Process

- Duplicate/check: `jd_501` not in `profiles`, `27662365822` not in `profiles.phone`, `jd_501@efa.local` not in `auth.users`.
- Auth created via `supabase.auth.admin.createUser` (email confirmed, user_metadata.username = `jd_501`).
- Profile upserted (`profiles`): username exact, phone digits-only, `must_change_password = true`.
- Assignment: `assignManagerToClub()` path attempted; the script's `createAdminClient()` had a db-shape mismatch (`db.from` not available), so assignment completed directly via `UPDATE teams` + `INSERT manager_tenures` + `INSERT audit_log` (same logic, audit preserved, `adminId = null`).
- Verified post-assignment:
  - `teams` (`Supersport` `408d5846-...`): `manager_id = 496001ab-a27f-41ae-93f1-689ba094189d`
  - `profiles`: `jd_501`, `27662365822`, `must_change_password = true`
  - `auth.users`: `jd_501@efa.local`, `encrypted_password = crypt('Efootball@2026', ...) = true`
  - `manager_tenures`: 1 row for user
  - `audit_log`: `assign_manager` written

## Restore / cleanup

Temporary SQL + create script kept (not recycled — the create script is the persistent record of the user creation; temp SQL moved to `.recycle`):
- `.recycle/scripts/_tmp-check-jd_501_2026-10-26.sql`
- `.recycle/scripts/_tmp-finish-jd_501-assign_2026-10-26.sql`
- `scripts/create-assign-jd_501-supersport_2026-10-26.ts` kept as creation record.
- `scripts/postpone-request-orlando-pirates-midlands-2026-10-25.ts` (pre-existing untracked) left untouched.
