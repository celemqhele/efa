# Merge "Managers" Page into "User Management" — single Users & Managers page

Merged the standalone admin `Manage Managers` page (`/admin/managers`) into the `User Management` page (kept at `/admin/users/manage`, re-titled **Users & Managers**) as a second view, removing the duplicate `Managers` nav links (dashboard quick-actions + mobile admin More menu).

## What was done

The `/admin/managers` page (team-centric "assign/remove a manager per club" grid) and `/admin/users/manage` page (user-centric: pending manager applications, pending team-change requests, and an all-users table) were consolidated into a single page at `/admin/users/manage` with a client-side two-tab switcher:

- **Users** tab — the original user-centric content (manager applications, team-change requests, all-users table with Sack / Make Admin / Reset Password actions), unchanged in behaviour.
- **Assign Managers** tab — the former `ManagersClient` team→manager grid (pick a club, assign/remove its manager, edit phone/WhatsApp number, availability schedule link, transfer manager data), moved and reused as-is.

## Problem solved

Admins previously had two overlapping admin pages — `Manage Managers` and `User Management` — linked from separate nav spots, causing duplication and confusion about where to manage users/teams/roles/applications. The merge gives one destination with both the team-first and the user-first view.

## Fix details

- `app/(admin)/admin/users/manage/page.tsx` — now fetches everything for both views: profiles (with `phone` for the WhatsApp button), raw teams, `teamByManager`, change requests, manager applications, `profileMap`, plus the manager-grid data (deduped `managerTeams` via `filterTeams`, `managedTeamByUser`, `hasAvailabilityIds`).
- `app/(admin)/admin/users/manage/UsersAndManagersClient.tsx` — **new** shared client component with the tab switcher; renders either the managers grid or the user-centric cards/table, taking a `variant: 'desktop' | 'mobile'`.
- `app/(admin)/admin/users/manage/ManagersClient.tsx` — **moved** here from the managers folder (previously `app/(admin)/admin/managers/ManagersClient.tsx`), unchanged logic.
- `app/(admin)/admin/users/manage/_desktop.tsx` / `_mobile.tsx` — now render `UsersAndManagersClient` with the matching variant (header re-titled "Users & Managers").
- `app/(admin)/admin/managers/{page,_shell,_desktop,_mobile,ManagersClient}.tsx` — **retired**: moved to `.recycle/admin-managers-page/` (see Restore File Section). The `/admin/managers/availability` sub-route and its files were left in place.
- `app/(admin)/admin/dashboard/_desktop.tsx` — removed the `Managers` quick-action from `ACTIONS` (Users already listed).
- `components/ui/AdminTabBar.tsx` — removed the `Managers` entry from `MORE_LINKS` (Users already listed), and dropped the now-unused `Users` lucide import.

## Verified

- `npx tsc --noEmit` — clean.
- `npm run lint` — only pre-existing warnings.
- `npm run build` — passes; `/admin/managers` root no longer generated, `/admin/managers/availability` still served, `/admin/users/manage` present.

## Related files

- The availability schedule deep link `/admin/managers/availability?managerId=...` is untouched and still referenced from the moved `ManagersClient` (see `.opencode/context/admin-dashboard/admin-dashboard-mobile-stack-and-admin-tabbar_2026-09-02.md` for the admin-tab context).

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `app/(admin)/admin/managers/page.tsx` | Managers page server component (assign/remove grid data) | `.recycle/admin-managers-page/page.tsx` |
| `app/(admin)/admin/managers/_shell.tsx` | Managers viewport shell | `.recycle/admin-managers-page/_shell.tsx` |
| `app/(admin)/admin/managers/_desktop.tsx` | Managers desktop wrapper | `.recycle/admin-managers-page/_desktop.tsx` |
| `app/(admin)/admin/managers/_mobile.tsx` | Managers mobile wrapper | `.recycle/admin-managers-page/_mobile.tsx` |
| `app/(admin)/admin/managers/ManagersClient.tsx` | Team→manager grid client component (superseded by the copy at `app/(admin)/admin/users/manage/ManagersClient.tsx`) | `.recycle/admin-managers-page/ManagersClient.tsx` |
