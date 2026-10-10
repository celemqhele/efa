# Export page filename includes the tournament, fixing 2-division collisions

The admin export page's PNG filename now includes a slug of the tournament name,
so exporting the two `league`-type divisions (Betway Premiership and Motsepe
Foundation Championship) no longer produces two downloads with the same filename.
The user reported the filename "hasn't accounted for 2 divisions yet".

## Problem

`app/(admin)/admin/export/page.tsx` built the filename as:

```
efa-${card.type}-${card.tournament.type}-${selectedDate}.png
```

The two divisions are both `tournaments.type = 'league'` (distinguished only by
`settings.division` 1/2), so selecting both for one export date gave e.g.
`efa-standings-league-2026-10-10.png` twice — the browser would collide / append
`(1)`. The same collision existed for the two `tournament_club` cups (CAF
Champions League and CAF Confederations League), which share that type too.

## Fix

`app/(admin)/admin/export/page.tsx` (~line 646): build a `tournamentSlug`
(lowercase, non-alphanumerics → `-`, trimmed) from `card.tournament.name` and use
it in place of `card.tournament.type`:

```
const tournamentSlug = card.tournament.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
const filename = `efa-${card.type}-${tournamentSlug}-${selectedDate}.png`
```

Now `efa-standings-betway-premiership-2026-10-10.png` vs
`efa-standings-motsepe-foundation-championship-2026-10-10.png`, and the cups get
`...-caf-champions-league-...` / `...-caf-confederations-league-...`.

## Verification

- `npx tsc --noEmit` clean.
- Slug is unique per tournament (names differ) and slug-safe for filenames.
- Chunked multi-card downloads still suffix `-part-N` via `ExportButton.tsx`.

## Context chain (by path)

- Export feature context (zones, chunking, group filter):
  `.opencode/context/admin-dashboard/export-zones-chunk-split-relegation_2026-10-02.md`,
  `.opencode/context/admin-dashboard/export-group-filter_2026-09-03.md`
- Two-division league setup:
  `.opencode/context/two-divisions/season-4-two-division-setup_2026-09-27.md`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |