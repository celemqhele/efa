# Admin Dashboard — Remove Desktop Top Actions & Move News to Pill

## Intro
Removed the sticky top actions strip (Submit Result, Fixtures, Seasons, Applications,
Polls, Hall of Fame, Export, Send Push, Backdoor, Users + News Topic Export) from
the desktop admin dashboard because the bottom admin pill nav
(`AdminNavDesktop`, added in `.opencode/context/admin-dashboard/desktop-admin-mode-pill_2026-09-03.md`)
now provides all the same navigation. This is the desktop counterpart to
`.opencode/context/admin-dashboard/admin-dashboard-remove-top-quickactions_2026-09-02.md`
which removed the mobile version yesterday.

## Problem
After the bottom admin pill nav was added to both desktop and mobile, the desktop
dashboard still rendered a redundant sticky top actions bar with the same links.
The mobile QuickActions had already been removed yesterday but the desktop was left
untouched. The News Topic Export button was also part of this top strip and would
become orphaned if only the strip was removed.

## Fix
1. Removed the `ACTIONS` const, its `ACTIONS.map()` rendering, the
   `<NewsTopicExportButton />` usage, the sticky wrapper div, and the unused
   `NewsTopicExportButton` import from `app/(admin)/admin/dashboard/_desktop.tsx`.
2. Moved "Generate News" into the **More** section of both admin pill navs:
   - `components/ui/AdminNavDesktop.tsx` — desktop floating pill
   - `components/ui/AdminTabBar.tsx` — mobile bottom tab bar
   Both now import `NewsTopicExportButton` and render it at the bottom of the
   More popover after the `MORE_LINKS` list.
3. Restyled `NewsTopicExportButton` (`app/(admin)/admin/dashboard/NewsTopicExportButton.tsx`)
   from a large standalone mobile button to a compact menu row (full-width,
   `px-4 py-3 rounded-lg`, matching the existing More menu item styling).
   Label shortened from "News Topic Export" to "Generate News".

### Files changed
- `app/(admin)/admin/dashboard/_desktop.tsx` — removed sticky top strip + ACTIONS const + NewsTopicExportButton import
- `app/(admin)/admin/dashboard/NewsTopicExportButton.tsx` — restyled to compact menu row; label → "Generate News"
- `components/ui/AdminNavDesktop.tsx` — added NewsTopicExportButton import + render in More popover
- `components/ui/AdminTabBar.tsx` — added NewsTopicExportButton import + render in More popover

## Notes / Gotchas
- `public/sw.js` is a Serwist build artifact; build regenerates it — reverted before commit (same as prior changes).
- `NewsTopicExportButton` is now only used inside the two pill nav More popovers; no other consumers.
- Verified `npx tsc --noEmit`, `npm run lint` (only pre-existing warnings), `npm run build` all pass.

## Related files
- `.opencode/context/admin-dashboard/admin-dashboard-remove-top-quickactions_2026-09-02.md`
  (mobile counterpart removed yesterday)
- `.opencode/context/admin-dashboard/desktop-admin-mode-pill_2026-09-03.md`
  (the bottom admin pill nav that makes the top strip redundant)
- `app/(admin)/admin/dashboard/NewsTopicExportButton.tsx`
  (the news export button, now restyled as a menu row)

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
