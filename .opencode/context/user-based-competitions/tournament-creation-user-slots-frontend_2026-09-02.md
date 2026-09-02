# Admin tournament-creation frontend converted to user/slot flow (2026-09-02)

Continued the user/slot model documented in
`.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`:
after the backend routes (`create-tournament`, `start-phase`) were switched to
accept `users[]` / `division*_users`, the admin frontends were still on the old
team/manager-based code. This change converts the create-tournament page and the
Start New Phase wizard to the same user/slot model, plus a seeded-draw fix in
`generate-fixtures`.

## Problem

- `/admin/tournaments/create` and the Start New Phase (seasons) flow still
  submitted `teams[]` + `manager_id` (and called `/api/admin/managers/assign` with
  a sack-cooldown dialog) — i.e. the legacy manager-assignment path, not the new
  user-owned slots.
- The tournaments list `page.tsx` used old inline rendering while the newer
  `_shell/_desktop/_mobile` design was dead code.
- `generate-fixtures/route.ts` (groups mode) always re-randomized the group
  assignment, discarding a seeded Run Draw.

## Fix

- **Seeded draw respected** — `app/api/admin/generate-fixtures/route.ts`: in
  `settings.fixture_mode === 'groups'`, if every participant already has a
  `group_name`, build groups from it, upsert `group_standings`
  (`onConflict: 'tournament_id,group_name,participant_id'`), and skip the shuffle;
  the random-shuffle fallback only runs when groups aren't yet assigned.
- **Tournaments list modernized** — `app/(admin)/admin/tournaments/page.tsx`
  now computes `{tournaments, participantCounts, fixtureCounts,
  completedCounts, koCounts, grouped}` and renders `<Shell>`, with
  `RescheduleFixturesButton` and `hasKnockouts`/`koCounts` parity on
  `_desktop.tsx` + `_mobile.tsx`.
- **Create tournament → user/slot** — `app/(admin)/admin/tournaments/create/*`:
  `page.tsx` loads `profiles(id, username)` + `teams(..., manager_id)` and builds
  `users` (only users who currently manage a club, with their club info);
  `CreateTournamentClient.tsx` was rewritten to a manager/user multi-select that
  POSTs `{ season_id, name, type, users, settings }` to `/api/admin/create-tournament`
  (friendlies = exactly 2 users). Removed the team picker, `manager_id`
  submission, `/api/admin/managers/assign`, and `SackCooldownDialog`.
- **Start New Phase → user/slot** — `app/(admin)/admin/seasons/*`:
  `page.tsx` supplies `users` (users + current club); SeasonManager wizard
  collapsed from 4 to 3 steps (removed "Assign Managers" + cooldown), picking
  managers per division and POSTing `division1_users`/`division2_users` to
  `/api/admin/start-phase`. Import-from-Poll now maps `/api/admin/polls`
  `applicant_id` → currently-club-managing users.

Only new/future tournaments & phases are affected; the existing International
tournament is untouched (its fixtures already exist and are 409-guarded).

## Verification

`npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass. No DB migration
needed.

## Files

- `app/api/admin/generate-fixtures/route.ts` (seeded-draw fix)
- `app/(admin)/admin/tournaments/page.tsx`, `_shell.tsx`, `_desktop.tsx`, `_mobile.tsx`
- `app/(admin)/admin/tournaments/create/page.tsx`, `_desktop.tsx`, `_mobile.tsx`, `CreateTournamentClient.tsx`
- `app/(admin)/admin/seasons/page.tsx`, `_shell.tsx`, `_desktop.tsx`, `_mobile.tsx`, `SeasonManager.tsx`
- Backends unchanged (already accept `users[]` / `division*_users`):
  `app/api/admin/create-tournament/route.ts`, `app/api/admin/start-phase/route.ts`,
  `lib/slot-utils.ts` (`resolveUserClubId`).
