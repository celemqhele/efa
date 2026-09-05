# Vacant seat → manager's club takeover (assign manager on the Vacant team page)

Implemented a follow-up to `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`: the user reported that on the **Vacant placeholder team page** (Standings → Vacant team → "Admin — Manager Controls"), assigning a manager who already manages a club was blocked — those managers were greyed out under "Already managing a club — sack first". Expected behavior: assigning a manager to the Vacant seat should fill that seat with the manager's real club (inheriting the seat's tournament stats) rather than refusing because they already run a club.

## Problem

- The Vacant placeholder team (`logo_league_folder = 'custom'`, `logo_team_slug = 'vacant'`) is not a real club, but the admin assign path treated it like one: `app/api/admin/managers/assign/route.ts` binds the user to the team via `teams.manager_id` and calls `reclaimManagerSlots`, which only refills seats matched by the club id — it never resolves the seat to the *manager's actual club*.
- `app/(public)/teams/[id]/TeamManagerAdmin.tsx` split profiles into `freeUsers` (no team) vs `busyUsers` (greyed out, non-clickable, "sack first"). The exact UI page the user saw was this team page, not the admin "Assign Managers" tab (the Vacant placeholder is filtered out of that tab's team list by `filterTeams` in `lib/allowed-teams.ts`).
- The vacant seat `5bbfef70-…` in the EFA International Cup had **4 pending auto-forfeit results** stamped by `vacateUserSlots` (all with `override_reason` = "Vacant slot absent — automatic 0-X", `finalised_by` = NULL, fixtures in `confirmed_pending`). Without revocation, a taking-over club would forfeit its first fixtures 0-3 without playing.

## Fix

### `lib/slot-utils.ts`
- Added `isVacantPlaceholderTeam(team)` — true when `logo_league_folder === 'custom'` and `logo_team_slug === 'vacant'`.
- Added `assignVacantSeatToManager(db, managerUserId, vacantTeamId)` — for every ACTIVE tournament, finds the manager's free vacant seats (`.is('user_id', null).eq('team_id', vacantTeamId)`) and fills each with the manager's actual club (`resolveUserClubId`): sets `user_id` + `team_id` to the club, clears `vacated_from_team_id`, restamps pending (`scheduled`/`awaiting_confirmation`/`confirmed_pending`) fixture home/away `team_id` → club, restamps `standings` + `group_standings` `team_id` → club, and calls `clearAutoForfeitResults`. It skips tournaments where the club already holds a seat (never a second club in the same tournament). Returns `{ action: 'claim' | 'fill', clubTeamId, filled }` — `'claim'` when the manager has no club (caller falls back to normal assign; seat renders Vacant until they get one).
- Added `clearAutoForfeitResults(db, tournamentId, participantId)` — deletes auto-generated forfeit results (`.is('finalised_by', null)` and `override_reason` starting "Vacant slot absent"/"Both slots vacant") on the seat's not-yet-played fixtures, and returns any `confirmed_pending` fixture back to `scheduled`. Human-entered results (`finalised_by` set) are never touched.

### `app/api/admin/managers/assign/route.ts`
- Added imports for the new helpers. After the normal assign + `reclaimManagerSlots`, added: if `isVacantPlaceholderTeam(team)` → `assignVacantSeatToManager(adminSupabase, user_id, resolvedTeamId)`. This lets the Vacant page takeover fill the manager's club into the seat.

### `app/(public)/teams/[id]`
- `page.tsx`: added `isVacantTeam` to the `data` payload (`team.logo_league_folder === 'custom' && team.logo_team_slug === 'vacant'`).
- `_desktop.tsx` + `_mobile.tsx`: destructured and passed `isVacantTeam={isVacantTeam}` to `<TeamManagerAdmin>`.
- `TeamManagerAdmin.tsx`: added optional `isVacantTeam` prop (default falsy). When true, ALL users (including those already managing a club) are listed as clickable "Assign →" buttons ("Manages X — takes over this seat") instead of the greyed-out "Already managing a club — sack first" block. Assign flows to the existing `/api/admin/managers/assign` route.

## Notes / decisions still open

- The auto-forfeit results on the vacant seat are **not** selected/committed yet; the takeover flow will clear them only when an assignment actually happens.
- The Group F 4th seat is still Vacant; the requested behaviour is to fill it via this flow with a manager's club. Filling the seat with jigsaw_rsa (`a83cecc6-…`, manages NAITOR `e36f49c5-…`) was part of the earlier plan but has **not** been executed (user said "don't touch the 4 pending auto-forfeit results" for a different seat; the takeover here clears the vacant seat's own auto-forfeits only when assigned).
- Not yet run: lint/build beyond `npx tsc --noEmit` (passed), and no live end-to-end test of the takeover assignment.