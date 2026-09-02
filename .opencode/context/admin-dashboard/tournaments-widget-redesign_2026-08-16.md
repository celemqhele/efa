# Admin Dashboard — Tournaments Widget Redesign + Postpone Overlay

## Problem
On `/admin/dashboard` the tournaments widget's action buttons were visually
inconsistent: `Fixtures`/`Standings` were outlined links, `Generate Fixtures`/
`Reschedule` were tiny gold chips (`btn-gold text-[10px] py-1 px-2`), and
`Run Draw`/`Generate Knockouts`/`Delete` were borderless text buttons
(`text-xs font-semibold py-2.5 px-1`). Sizes, padding and gaps were all
different (`gap-1.5` with mismatched heights), so the row looked ragged.

Separately, in the **Fixtures Due** section, clicking **Postpone** rendered the
`datetime-local` form in-flow below the action buttons, which grew the table row
height and pushed every component below it out of place (layout shift).

## Fix

### 1. Uniform tournament card buttons (`app/(admin)/admin/tournaments/card-action-classes.ts`)
Added a single source of truth for the card-button style:
- `CARD_ACTION_BTN` — neutral outline chip:
  `inline-flex items-center justify-center whitespace-nowrap text-xs font-semibold px-3 py-2 rounded-lg border border-border text-text-secondary hover:border-accent hover:text-accent transition-colors`
- `CARD_ACTION_BTN_DANGER` — same, but red (used by Delete).

All six button components now default to these classes (`className` prop, was
already supported in 4 of them, added to `GenerateFixturesButton` and
`RescheduleFixturesButton`). Every view passes the shared classes so the row is
uniform and evenly spaced (`gap-2` instead of `gap-1.5`):
- `app/(admin)/admin/dashboard/_desktop.tsx` — tournaments widget `TournamentCard`
- `app/(admin)/admin/tournaments/page.tsx` — standalone card view
- `app/(admin)/admin/tournaments/_desktop.tsx` — table view
- `app/(admin)/admin/tournaments/_mobile.tsx` — grid view (`min-h-[48px]` touch-friendly local variants `MOBILE_ACTION_BTN[_DANGER]`)
- `app/(admin)/admin/tournaments/[id]/page.tsx` — detail view (`DETAIL_ACTION_BTN[_DANGER]`)

### 2. Postpone widget no longer shifts layout (`components/ui/DashboardFixtureActions.tsx`)
The date form now renders in a **floating overlay** instead of in-flow:
- On toggle, `getBoundingClientRect()` of the actions row is measured and the
  popover is positioned `position: fixed` just below/right of the buttons
  (clamped to the viewport, `max-w-[calc(100vw-1rem)]`).
- Rendered through `ModalPortal` (`#portal-root` in `app/layout.tsx`) so it is
  never clipped by `overflow-x-auto`/`overflow-hidden` wrappers.
- Styled `bg-bg-elevated border border-border rounded-lg shadow-md`, animated
  with `animate-fade-in` (transform/opacity only — no layout impact).
- Closes on Save, ×, Escape, outside click, scroll or resize.
- Because the overlay takes no space in the table row / mobile card, the rows
  and cards stay exactly where they are when it opens.

## Notes / Gotchas
- `npx tsc --noEmit` passes. `next lint` reports only pre-existing warnings
  (unused `Button` import in `GenerateFriendliesButton.tsx`, `exhaustive-deps`
  in `GenerateKnockoutsButton.tsx`).
- Run Draw / Generate Knockouts / Generate Friendlies **modal interiors** still
  use stale classes (`bg-gold`, `text-foreground-primary`, `animate-scale-in`,
  `bg-navy-light`) that are not in the Tailwind theme — only their trigger
  buttons were touched here. Modal interiors are a potential follow-up.
- No API/schema changes.

## Related files
- The same `TournamentCard` buttons were later made equal-width in
  `.opencode/context/admin-dashboard/tournaments-widget-equal-width-grid_2026-08-16.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
