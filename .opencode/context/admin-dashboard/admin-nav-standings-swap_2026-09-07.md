# Admin Nav — Swap "Applicants" tab for "Standings" (desktop + mobile)

## Intro
Swapped the primary "Applicants" tab in both admin pill navs (desktop `AdminNavDesktop` and mobile `AdminTabBar`) for a **Standings** link (`/standings`, `Trophy` icon), and moved **Applicants** (`/admin/tournament-applications`, `UserCheck` icon) into the More popover so the route stays reachable. Applied identically to desktop and mobile.

## Problem
The admin nav primary tabs carried "Applicants", but admins wanted quick access to **Standings** (`/standings`, the public league table) while in admin mode on both desktop and mobile. The Applicants route itself still needs to be reachable for managing season/tournament applications.

## Fix
- `components/ui/AdminNavDesktop.tsx` — `ADMIN_TABS`: replaced `{ href: '/admin/tournament-applications', label: 'Applicants', icon: UserCheck }` with `{ href: '/standings', label: 'Standings', icon: Trophy }`; `MORE_LINKS`: added `{ href: '/admin/tournament-applications', label: 'Applicants', icon: UserCheck }`.
- `components/ui/AdminTabBar.tsx` — same two changes (mobile bottom pill). Both icons were already imported in both files, so no import churn.

## Notes / Gotchas
- `Trophy` and `UserCheck` were already imported in both nav files; no icon import changes needed.
- `isActiveLink` treats `/standings` as a plain exact/prefix route link — it only activates on `/standings` and sub-paths.

## Related files
- Desktop pill origin: `.opencode/context/admin-dashboard/desktop-admin-mode-pill_2026-09-03.md`.
- Mobile admin bar origin: `.opencode/context/admin-dashboard/admin-dashboard-mobile-stack-and-admin-tabbar_2026-09-02.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |