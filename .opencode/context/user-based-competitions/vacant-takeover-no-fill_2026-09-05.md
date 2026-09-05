# Vacant take-over didn't fill the seat (manager bound to Vacant placeholder instead)

Follow-up to `.opencode/context/user-based-competitions/vacant-seat-manager-takeover_2026-09-05.md`. The user assigned jigsaw_rsa (`a83cecc6-…`) to the **Vacant** placeholder team page, but the group standings still showed "Vacant" instead of Canada. Root cause: the assign ran against the pre-fix build — the route bound `manager_id` to the Vacant placeholder team (`820ea628-…`) and `reclaimManagerSlots` "filled" the seat with `user_id` set but `team_id` still the Vacant placeholder. The user also clarified the two assign operations are conceptually distinct: **assign → Vacant** = add the manager's user to a tournament seat and replace the Vacant placeholder with the manager's club; **assign → a real club** = bind the manager to the club for future use, unrelated to seats.

## Problem

- Live DB (before fix): seat `5bbfef70-…` had `user_id = a83cecc6…` but `team_id = 820ea628…` (Vacant) and `vacated_from_team_id = NULL` — the old code path produced this by running the normal club-bind for the Vacant placeholder.
- The Vacant placeholder team row (`820ea628-…`) had `manager_id = a83cecc6…` polluted by that old bind, plus an open tenure.
- `assignVacantSeatToManager` only matched seats with `user_id IS NULL`, but the seat already carried jigsaw's `user_id`, so a re-assign could not fill it.
- The user's club is **Canada** (`2c4a51fa-…`), not "NAITOR" (NAITOR `e36f49c5-…` is a *user*, not a team). The real objective-label "NAITOR" was a mislabel; the correct fill target is Canada.

## Fix

### `app/api/admin/managers/assign/route.ts`
- Restructured so the Vacant placeholder is never bound to a manager: the `teams.manager_id` update + tenure close/open now only run inside `if (!isVacant)`. For `isVacant`, the route only calls `assignVacantSeatToManager` (then returns). A real-club assign still runs `reclaimManagerSlots`.

### `lib/slot-utils.ts`
- Added `resolveUserClubIdExcluding(db, userId, excludeIds)` — resolves the club a user manages while skipping the Vacant placeholder (custom/vacant) and any excluded ids, so the takeover never treats "Vacant" as the manager's club. `assignVacantSeatToManager` now uses it.
- `assignVacantSeatToManager` now matches seats feeding a takeover with `.or('user_id.is.null,user_id.eq.<manager>')` — handles both bare vacant seats AND seats already "claimed" (user_id set) by that manager but still showing Vacant.

### Live DB (`scripts/apply-vacant-takeover-canada.sql`, applied via `npm run db`)
- Cleared the stray `manager_id` + open tenure on the Vacant placeholder team.
- Filled seat `5bbfef70-…`: `user_id = a83cecc6…`, `team_id = 2c4a51fa…` (Canada), `vacated_from_team_id = NULL`.
- Restamped the seat's group_standings + standings rows and its 4 pending fixtures (home/away `team_id` → Canada; status → `scheduled`), and deleted the 4 auto-forfeit results (`override_reason` starting "Vacant slot absent"/"Both slots vacant", `finalised_by NULL`) so Canada actually plays them.
- Verified: seat shows Canada, histories keep P2/L2, could-beppends now scheduled with no auto results, Vacant placeholder managerless again.

## Notes

- The feature's UI (`TeamManagerAdmin.tsx`, `isVacantTeam` prop) was unchanged by this follow-up — the new build is what matters.
- Not pushed/deployed yet at time of writing (next step was to commit + push `5625cd3`-era working tree additions: route restructure, slot-utils helpers, this SQL).