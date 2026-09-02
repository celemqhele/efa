# Create EFA user "NAITOR" + assign to Algeria (31 Aug)

Created a new EFA user with username `NAITOR`, the default platform password
(`Efootball@2026`), and immediately assigned them as manager of the **Algeria**
national team — following the same pattern as
`.opencode/context/user-management/create-tbhotouch-user_2026-08-30.md`
(create the auth user) combined with
`.opencode/context/user-management/assign-usa-manager-backdate-tenure_2026-08-30.md`
(assign the manager to a team).

## What was done

**1. Created the user** via one-off script (`scripts/create-naitor-user.ts`),
modeled on `scripts/create-tbhotouch-user.ts`, which used the Supabase admin API
(`supabase.auth.admin.createUser`):

- Username `NAITOR`, email `naitor@efa.local`, password `Efootball@2026`,
  `email_confirm: true`.
- Confirmed the `profiles` row (`role = user`).

Auth user id: `e36f49c5-f16d-43d0-823d-e318fa8e8f99`.

**2. Assigned to Algeria** via one-off SQL (`scripts/assign-naitor-algeria.sql`),
mirroring what the admin assign route
(`app/api/admin/managers/assign/route.ts`) does:

- Algeria team id: `3241dc70-7674-4662-9cbc-b3f0471e93d4`
  (`logo_league_folder = fifa-world-cup-2026.football-logos.cc`,
  `logo_team_slug = algeria-national-team`). It was **vacant** (no manager).
- Set `teams.manager_id = e36f49c5...` on the Algeria row.
- Opened an open-ended `manager_tenures` row (`manager_username = NAITOR`).

## Notes

- Algeria has **no sibling club rows** (its `logo_league_folder`/`logo_team_slug`
  are unique to it), so only the single Algeria team row was updated.
- The default password `Efootball@2026` matches the platform default defined in
  `app/api/webhook/route.ts` (`DEFAULT_USER_PASSWORD`) and
  `app/api/admin/reset-password/route.ts` (`DEFAULT_PASSWORD`).

## Files
- `scripts/create-naitor-user.ts` — one-off user-creation script.
- `scripts/assign-naitor-algeria.sql` — one-off assignment SQL (kept alongside
  other one-off scripts in `scripts/`).

## Run
```bash
npx tsx scripts/create-naitor-user.ts
npm run db -- scripts/assign-naitor-algeria.sql
```
