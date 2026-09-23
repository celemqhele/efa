# Admin Fixtures Manage — Clickable Fixture Rows

## Intro
Made every fixture on `/admin/fixtures/manage` open its full fixture detail page (`/fixtures/[id]`) by clicking the row/card, so admins no longer have to detour through standings → team → history to view a match. Worked on both desktop (table) and mobile (card) variants.

## Problem
The admin Fixture Management page (with scores already displayed from earlier work) had no way to open a fixture's detail page. The user's current path was standings → click a team → team history → click a match — too many steps when managing fixtures.

## Fix
- `app/(admin)/admin/fixtures/manage/_desktop.tsx` — wrapped the Time, Round, Home, Score, Away and Status table cells in `<Link href={/fixtures/${fx.id}}>` (all non-action cells), leaving the Actions column untouched so the postpone/batch/submit/reset buttons keep working. Added `group` to the `<tr>` and `group-hover:text-accent` on the linked text (incl. the score) so rows read as clickable. The fixture detail page is a public route, so admins reach it fine.
- `app/(admin)/admin/fixtures/manage/_mobile.tsx` — wrapped the card header (time/round/status) + teams/score block in `<Link href={/fixtures/${fx.id}}>`, with `group`/`group-hover:text-accent` on team names. `FixtureActions` stays outside the link so buttons remain independently clickable.
- Both files already imported `Link` from `next/link`, no import churn. Verified with `npx tsc --noEmit` (clean).

## Notes / Gotchas
- The Actions column must NOT be inside the clickable area — nested interactive elements (buttons/links) inside a link are invalid and would break the action buttons.
- Fixture detail page: `app/(public)/fixtures/[id]/page.tsx` (public route, uses `createClient()`), so no auth guard blocks admins.
- Same per-cell link pattern as the public fixtures list (`app/(public)/fixtures/_desktop.tsx`) which already links rows to `/fixtures/{id}`.

## Related files
- Detail page that receives the clicks:
  `app/(public)/fixtures/[id]/page.tsx` + its `_shell/_desktop/_mobile`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |