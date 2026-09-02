# Admin Dashboard — Equal-Width 2-Column Tournament Card Buttons

## Problem
The tournament card action buttons were the same size/height but not the same
**width** — a button's width followed its label ("Generate Fixtures" is wide,
"Delete" is narrow), so the rows looked uneven even with `gap-2` spacing.

## Fix
Switched the card button rows from `flex flex-wrap gap-2` to a
`grid grid-cols-2 gap-2`. CSS Grid items stretch to fill their column, so every
button is exactly half the card width regardless of label length.

Layout (button order unchanged; grid auto-fills rows):
- Row 1: Fixtures | Generate Fixtures
- Row 2: Reschedule | Standings
- Row 3: Run Draw | Generate Knockouts (club/international only)
- Row 4: Delete

### Odd-count handling
Delete spans the full row (`col-span-2`) whenever it would otherwise sit alone:
```tsx
const isClubType = ['tournament_club', 'tournament_international'].includes(tournament.type)
const actionCount = 4 + (fixtureCount > 0 ? 1 : 0) + (isClubType ? 2 : 0)
const deleteClass = `${CARD_ACTION_BTN_DANGER}${actionCount % 2 === 1 ? ' col-span-2' : ''}`
```
- league/etc. with Reschedule visible: 5 buttons → odd → Delete full width.
- league/etc. with 0 fixtures (Reschedule hidden): 4 buttons → even → Delete half.
- club/international: 7 buttons (6 with no Reschedule) → same rule.

### Files changed
- `app/(admin)/admin/dashboard/_desktop.tsx` — `TournamentCard` (the widget)
- `app/(admin)/admin/tournaments/page.tsx` — standalone `TournamentCard`

### Not changed
- `tournaments/_desktop.tsx` table view — keeps a compact flex row (a 2-col grid
  would triple table row height); buttons there already share height/spacing.
- `tournaments/_mobile.tsx` (`grid-cols-3`) and `[id]/page.tsx` (`grid-cols-2`)
  already render equal-width buttons.
- Dashboard mobile (`_mobile.tsx`) uses whole-card links, unaffected.

## Notes / Gotchas
- `isClubType` replaced the repeated inline
  `['tournament_club', 'tournament_international'].includes(tournament.type)`
  checks in both cards.
- No `w-full` needed — grid item default `justify-items: stretch` fills the track.
  `whitespace-nowrap` labels fit at `text-xs` in half-width cards; would overflow
  if the dashboard grid ever gets much narrower.
- `npx tsc --noEmit` passes; `next lint` clean on both edited files. No API/schema
  changes.

## Related files
- Direct follow-up to the TournamentCard button uniformization in
  `.opencode/context/admin-dashboard/tournaments-widget-redesign_2026-08-16.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
