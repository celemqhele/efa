# Desktop Pill Nav — Admin mode menu (mirror the mobile admin/manager switch)

Made the desktop floating pill navigation swap its menu options between normal **user** mode and **admin** mode when on `/admin/*` (mirroring the existing mobile `AdminTabBar` behavior), while keeping the desktop pill's own styling and layout — the only thing that changes is the link set.

## What was done

`Nav._desktop.tsx` now returns a new `AdminNavDesktop` pill (same `fixed bottom-6`, `hidden lg:block`, floating rounded bar) when `isAdmin && pathname.startsWith('/admin')`. In admin mode the pill shows admin links instead of the user links (Home / Fixtures / Results / Standings), plus a **Manager Mode** link back to `/` and Logout. Not a copy of the mobile UI layout — the desktop pill's look is preserved; only the menu items swap, drawn from the same admin option set the mobile admin tab bar uses.

## Problem solved

The mobile app switches into admin mode (admin tabs + More + Manager Mode exit) when an admin lands on `/admin/*` (see `.opencode/context/admin-dashboard/admin-dashboard-mobile-stack-and-admin-tabbar_2026-09-02.md`). Desktop still showed the normal user menu even on admin pages, with only a small faint dashboard icon — so admins on desktop had no clear admin navigation or way to see they were in admin mode.

## Fix details

- `components/ui/AdminNavDesktop.tsx` — **new**. Mirrors the desktop pill styling of `Nav._desktop.tsx` but renders admin links:
  - **Primary tabs**: Dashboard, Fixtures (`/admin/fixtures/manage`), Seasons, Applicants (`/admin/tournament-applications`), Users (`/admin/users/manage`).
  - **More drop-up popover**: Submit Result, Polls, Hall of Fame, Export, Send Push, Backdoor.
  - **Trailing**: Manager Mode (→ `/`) + profile + Logout.
  - Desktop gets more room, so primary tabs carry a couple more high-use admin links than the mobile `ADMIN_TABS`.
- `components/ui/Nav._desktop.tsx` — added an early return: when `isAdmin && pathname.startsWith('/admin')`, render `<AdminNavDesktop profile={profile} handleLogout={handleLogout} />` instead of the normal nav body. The existing `isAdmin` `LayoutDashboard` icon remains for admins browsing non-admin pages.

Because both the desktop admin pill and the mobile `AdminTabBar` use `lg:` breakpoint gating (`hidden lg:block` vs `lg:hidden`), the two never render at the same viewport.

## Verified

- `npx tsc --noEmit` — clean.
- `npm run lint` — only pre-existing warnings.
- `npm run build` — passes.

## Related files

- Mobile admin-mode convention: `.opencode/context/admin-dashboard/admin-dashboard-mobile-stack-and-admin-tabbar_2026-09-02.md`.
- The `Users` primary tab here points at the merged page from `.opencode/context/user-management/merge-managers-users-page_2026-09-03.md`.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
