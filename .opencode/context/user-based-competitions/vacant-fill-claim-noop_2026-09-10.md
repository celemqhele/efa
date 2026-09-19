# Vacant seat "fill" was a silent no-op for club-less users — fixed + Mexico seat filled

Filled the vacated (ex-Croatia) International Cup seat with **Mexico** (owner `khumoshxta`) via a one-off DB script, and fixed the root cause behind the reported behavior: assigning a user with **no club** on the Vacant team page returned `success` without touching any seat, so the UI showed a misleading "Current manager" while the standings stayed Vacant — the `claim` path of `assignVacantSeatToManager` was a no-op. A user-visible failure on the Vacant take-over flow built in `.opencode/context/user-based-competitions/vacant-seat-manager-takeover_2026-09-05.md` (and its follow-up `.opencode/context/user-based-competitions/vacant-takeover-no-fill_2026-09-05.md`).

## Problem

- Admin disqualified Croatia (`disqualify_manager` at 2026-09-10T17:46 – `vacateUserSlots` made seat `2c101774-…` ownerless, `team_id` → Vacant placeholder `820ea628-…`, `vacated_from_team_id` = Croatia `c6c51c9f-…`), then assigned **Mexico** to profile `khumoshxta` (`5c91fd0a-…`) at 17:45:48, then tried twice (17:46:58, 17:47:37) to fill the Vacant seat from the Vacant team page — but each pick was the **wrong profile** `khumoshxta_` (`e832e9d3-…`), a separate account that manages **no club**.
- `assignVacantSeatToManager` (lib/slot-utils.ts) hit `!clubTeamId` → returned `{ action: 'claim', filled: 0 }` having done **nothing** (no `user_id` stamp, no seat fill), while `app/api/admin/managers/assign/route.ts` still returned `success:true` and `TeamManagerAdmin.tsx` optimistically set the "Current manager" card from client state only — nothing persisted. Seat stayed Vacant, UI claimed otherwise. This contradicts the route's own comment ("a manager with no club simply takes ownership of the seat (user_id on the seats)") — the documented `claim` behavior was never implemented.
- Audit trail confirmed it: two `assign_manager` logs target the Vacant placeholder with `assigned_user_id: e832e9d3-…` (khumoshxta_), while the Mexico assign at 17:45:48 used `5c91fd0a` (khumoshxta). Two very similar usernames (`khumoshxta` / `khumoshxta_`) made the wrong pick easy, and there are **no other vacant seats** in the cup (31 owned + this 1 Vacant; Mexico had no seat, so filling wasn't a duplicate).

## Fix

### Data — `scripts/fill-vacant-seat-mexico.sql` (applied via `npm run db -- `)
- Seat `2c101774-0983-4efd-89dc-502f58136250` → `user_id = 5c91fd0a-…` (khumoshxta), `team_id = 296d42ad-…` (Mexico), `vacated_from_team_id = NULL`.
- Restamped its `group_standings` (Group C) + any `standings` row to Mexico, and pending fixtures (MD88 `ceebf376-…`, MD93 `d5f28fdf-…`) away side → Mexico.
- Deleted the seat's auto-forfeit `results` (MD88/MD93, `finalised_by` NULL, `'Vacant slot absent'`/`'Both slots vacant'` prefixes) and reset those fixtures `confirmed_pending` → `scheduled` (guarded by `NOT EXISTS` on a result row).
- Untouched: the seat's 3 confirmed Croatia games and the MD52 human backdoor forfeit (`finalised_by` set) stay as history; standings continuity (P4, then 4 pts → Croatia's forfeit outcomes) rolls under Mexico via slot-follows-team.
- Verified live: seat = Mexico/khumoshxta, `vacated_from_team_id` NULL; MD88/MD93 now `scheduled` vs Mexico with no results; group standings team_id = Mexico; 4 confirmed fixtures intact.

### Code — `claim` path is no longer a silent no-op
- `lib/slot-utils.ts` — `assignVacantSeatToManager` return type gains `clubName`; when the user has no club it now delegates to new `claimVacantSeats(db, managerUserId, vacantTeamId)`, which stamps `user_id` on the user's ownerless Vacant seats in every ACTIVE tournament (display `team_id` / fixtures stay Vacant until the manager gets a club) and returns `{ action: 'claim', clubTeamId: null, clubName: null, filled }`. Matches the behavior promised in `app/api/admin/managers/assign/route.ts:94-98` and the existing `.or('user_id.is.null,user_id.eq.<manager>')` fill matcher.
- `app/api/admin/managers/assign/route.ts` — the `isVacant` branch returns structured results instead of blanket `success:true`: `{ action: 'claim', filled, message: 'No club found for @… — the seat is claimed (still shows as Vacant)…' }` or `{ action: 'fill', club, filled, message: '<Club> has taken over the vacant seat.' }`.
- `app/(public)/teams/[id]/TeamManagerAdmin.tsx` — new `assignNotice` state (`setAssignNotice` on assign; cleared on sack/disqualify/assign start; rendered as a sky-blue info box). On `action === 'claim'` it shows the message and does **not** flip the misleading "Current manager" card; on `fill` it keeps the existing card behavior and adds the message.
- `npx tsc --noEmit` clean; `npm run lint` only pre-existing warnings (unchanged files).

## Restore File Section
- (none — one new script, no recyclings)

## Cross-references
- Feature this lies on top of: `.opencode/context/user-based-competitions/vacant-seat-manager-takeover_2026-09-05.md`
- Prior "didn't fill" follow-up this continues: `.opencode/context/user-based-competitions/vacant-takeover-no-fill_2026-09-05.md`
- Disqualify-vs-sack action used to vacate Croatia: `.opencode/context/user-based-competitions/disqualify-vs-sack-team-page_2026-09-05.md`
- Slot model / vacate restamp / auto-forfeit the fill clears: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`, `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`
- Earlier one-off seat repair pattern this script mirrors: `scripts/cup-slot-repair.sql` (from `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`)
- Group-branch status fix that the cleared pending fixtures rely on: `.opencode/context/user-based-competitions/vacant-group-forfeit-status-fix_2026-09-09.md`

## Notes / follow-ups
- `khumoshxta` is still under the 7-day sack cooldown (sacked 2026-09-07 → ends 2026-09-14): any future UI re-assign of this manager (e.g. reclaiming another seat) needs the admin "override" step.
- `claimVacantSeats` intentionally does not touch fixtures/results — a claimed-but-clubless seat keeps its Vacant auto-forfeits so the slot keeps playing.