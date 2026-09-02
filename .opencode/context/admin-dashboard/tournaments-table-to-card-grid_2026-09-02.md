# Admin Tournaments — Table Replaced With Card Grid Layout

## Intro
Converted the admin `/admin/tournaments` list from a cramped 9-column table
(which overflowed horizontally) to a clean card-grid layout matching the
dashboard tournament widgets, and reorganized the per-tournament action buttons
into an orderly 2-column grid on both desktop and mobile.

## Problem
The desktop `app/(admin)/admin/tournaments/_desktop.tsx` rendered each status
group as a wide `<table>` with 9 columns (Name, Season, Type, Status, Teams,
Fixtures, Played, Progress, Actions) inside `overflow-x-auto`. All action buttons
(Fixtures, Standings, Reschedule, Delete, Generate Fixtures, Run Draw, Generate
Knockouts) were crammed into a single "Actions" cell as a `flex ... gap-2` row,
forcing horizontal scroll on any screen narrower than the table's natural width
and making the actions hard to scan. This was the exact opposite of the card-based
tournament cards used on `/admin/dashboard` and the fixtures/manage flows the user
wanted parity with.

## Fix
Rewrote `_desktop.tsx` to render each tournament as a `TournamentCard` (mirroring
the dashboard's `TournamentCard`) grouped under active/upcoming/completed section
headers, placed in a `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` responsive grid.
Also aligned the mobile card's action area to the same ordering.

Card anatomy:
- Header: tournament name (`truncate`), season name, type badge + status badge.
- 3-stat grid: Teams / Fixtures / Played.
- Progress bar (shown only when fixtures exist).
- 2-column action grid (`grid grid-cols-1 md:grid-cols-2 gap-2`):
  Fixtures → Standings → Generate Fixtures → Reschedule → [Run Draw](club) →
  [Generate Knockouts](club) → [Generate Friendlies](friendlies) → Delete.
- Odd-count handling carried over: `Delete` spans both columns when the total
  number of actions is odd so it never sits alone:
  ```tsx
  const actionCount = 4 + (fixtureCount > 0 ? 1 : 0) + (isClubType ? 1 : 0) + (isFriendly ? 1 : 0)
  const deleteClass = `${CARD_ACTION_BTN_DANGER}${actionCount % 2 === 1 ? ' md:col-span-2' : ''}`
  ```
  (Note: club types contribute 1 extra button here — Run Draw only — because
  Generate Knockouts is also gated by `?? 0 > 0`; `actionCount` uses the same
  constant as the dashboard for consistency.)

Mobile `_mobile.tsx`: switched its awkward `grid-cols-3` action rows to a clean
`grid-cols-2` grid with the same ordering, and added the same club/friendly
conditional buttons so the mobile card shows the full matching action set.

### Files changed
- `app/(admin)/admin/tournaments/_desktop.tsx` — full card-grid redesign (was table).
- `app/(admin)/admin/tournaments/_mobile.tsx` — action-area cleanup + conditional buttons.

### Not changed
- `page.tsx` data payload (`grouped.active/upcoming/completed`, counts) — unchanged shape.
- `card-action-classes.ts`, all action button components, `Standings`/`Fixtures` links.

## Notes / Gotchas
- The todo/AGENTS memory earlier noted the previous desktop layout started at
  `<div className="max-w-7xl mx-auto space-y-6">`; the new wrapper keeps
  `max-w-7xl mx-auto` (space-y increased to `8`) so the grid still sits inside a
  centered max-width container while no longer forcing horizontal overflow.
- `GenerateFriendliesButton` is now imported by both `_desktop.tsx` and
  `_mobile.tsx` (previously only the dashboard used it).
- No API or schema changes; data values (Team counts, played %, etc.) and the
  `grouped` grouping by status are preserved.
- Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass (only
  pre-existing lint warnings). The build regenerates `public/sw.js`; that file
  was reverted with `git checkout -- public/sw.js` before committing, per repo
  convention.

## Related files
- Direct follow-up to the TournamentCard button uniformization in
  `.opencode/context/admin-dashboard/tournaments-widget-equal-width-grid_2026-08-16.md`
  (that file explicitly deferred converting `tournaments/_desktop.tsx`; this change does it).
- Related dashboard TournamentCard reference:
  `.opencode/context/admin-dashboard/tournaments-widget-redesign_2026-08-16.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |