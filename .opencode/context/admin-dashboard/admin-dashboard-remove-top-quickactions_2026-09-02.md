# Admin Dashboard — Remove Top QuickActions (mobile)

## Intro
Removed the horizontal QuickActions chip strip from the top of the mobile admin
dashboard because the new admin pill tab bar at the bottom (added in
`.opencode/context/admin-dashboard/admin-dashboard-mobile-stack-and-admin-tabbar_2026-09-02.md`)
already covers every action (Dashboard/Fixtures/Seasons/Applicants + More
popover), so the duplicate top menu only consumed vertical space.

## Problem
After adding the admin bottom tab bar, the mobile admin dashboard still rendered
a second navigation: the `QuickActions` row (Submit Result, Fixtures, Seasons,
Applications, Managers, Polls, Hall of Fame, Export, Send Push, Backdoor, Users)
plus the `NewsTopicExportButton`. Redundant with the bottom menu.

## Fix
- Deleted the `ACTIONS` const, the `QuickActions` component, and its
  `<QuickActions />` usage from `app/(admin)/admin/dashboard/_mobile.tsx`.
- Removed the now-unused `NewsTopicExportButton` import and the pre-existing
  unused `ChevronLeft` lucide import.
- Desktop dashboard untouched — it has no bottom pill bar, so its sticky top
  actions row still provides its navigation.

### Files changed
- `app/(admin)/admin/dashboard/_mobile.tsx`

## Notes / Gotchas
- `NewsTopicExportButton` (news-topic export) is still reachable via the
  desktop dashboard's top actions; only its mobile strip entry was dropped.
- Verified `npx tsc --noEmit`, `npm run lint` (clean), `npm run build`; build
  regenerated `public/sw.js` which was reverted before commit.

## Related files
- `.opencode/context/admin-dashboard/admin-dashboard-mobile-stack-and-admin-tabbar_2026-09-02.md`
  (the change that introduced the bottom menu making this removal sensible).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |