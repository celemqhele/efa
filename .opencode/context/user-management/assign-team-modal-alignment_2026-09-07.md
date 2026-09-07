# User Management — "Assign" team action + picker modal + fixed button alignment

## Intro
Added an **Assign** action for managers without a team on the `/admin/users/manage` all-users list, opening a searchable team-picker modal (with logos, grouped by league) that calls the existing `/api/admin/managers/assign` endpoint — so admins can assign a club to a manager directly from the Users tab on desktop **and mobile** (which previously had no way to search teams). Also made the desktop action buttons (Sack/Assign, Make/Remove Admin, Reset Password) sit in a fixed 3-slot grid so rows align whether or not the user has a team.

## Problem
1. Assigning a club required going to the team-centric "Assign Managers" tab and hunting the team; on mobile there was no search at all. The user-centric Users tab only had **Sack** (when the user has a team), **Make Admin**, and **Reset Password**.
2. Desktop table rows with no team had no Sack button, so the remaining "Make Admin"/"Reset Password" buttons rendered at different x-positions than rows that did have a team — misaligned columns.

## Fix
### Assign action + searchable picker modal
- `app/(admin)/admin/users/manage/UserActionButtons.tsx`:
  - New props `teams` (the deduped+filtered `managerTeams` from the page) and `profiles` (for "@ manager" labels on taken clubs).
  - First action slot now shows **Sack** when the user has a team, or **Assign** (gold outline) when they don't — so a button always occupies that slot.
  - Assign opens a `BottomSheet` (`desktopMaxWidth="max-w-3xl"`: desktop centered modal / mobile bottom sheet) titled "Assign a team to @username" containing:
    - A **search input** (works on mobile too — fixes the no-search gap).
    - A team grid with `Image` logos (`/logos/{folder}/128x128/{slug}.png`), grouped by league via `LEAGUE_META` country — `league` label, sorted by country/name.
    - **Only vacant teams are selectable**; managed clubs are greyed out (`opacity-50`, disabled) with the current manager's username shown on the card, matching the "Taken" pattern in the polls team grid.
  - Selecting a team POSTs `/api/admin/managers/assign` with `{ team_id, user_id, override }`. A `SACK_COOLDOWN` (409) response opens the existing `SackCooldownDialog` with an **Override** action (same flow as `ManagersClient`). On success the modal closes, local state flips to `hasTeam`, and `router.refresh()` re-syncs the server-rendered table.
- `app/(admin)/admin/users/manage/UsersAndManagersClient.tsx` — both `UserActionButtons` call sites (desktop `:358`, mobile `:418`) now receive `teams={managerTeams ?? []}` and `profiles={profiles ?? []}`.

### Fixed desktop alignment
- The action container in `UserActionButtons` changed from `flex flex-wrap` to a desktop **fixed 3-slot grid** (`lg:grid lg:grid-cols-[minmax(6.5rem,auto)_minmax(7.5rem,auto)_minmax(8.5rem,auto)]`): slot 1 = Sack/Assign, slot 2 = Make Admin/Remove Admin, slot 3 = Reset Password. Every row's buttons now align regardless of team presence. Mobile keeps the wrap layout (per-user cards, no cross-row alignment concern).
- Error / "password reset" messages moved out of the button row to a full-width line underneath so they never shift the buttons.

## Notes / Gotchas
- Reuses `/api/admin/managers/assign` and `SackCooldownDialog` verbatim — no new API route.
- The picker uses `managerTeams` (deduped by logo + `filterTeams`), the same data already feeding the "Assign Managers" tab (`ManagersClient`).
- `<BottomSheet>` is called **without** the `title` prop so the desktop/mobile padding stays consistent; the modal renders its own header + close button inside the padded content.
- Verified `npx tsc --noEmit`, `npm run lint` (only pre-existing warnings), `npm run build` all pass; build-regenerated `public/sw.js` reverted before commit.

## Related files
- Assign endpoint + cooldown logic: `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`.
- The merged page this lives in: `.opencode/context/user-management/merge-managers-users-page_2026-09-03.md`.
- Team grid card style modeled on the poll picker: `app/(public)/polls/[share_code]/PollClient.tsx`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |