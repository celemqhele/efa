# Export Standings: Promotion/Relegation Zones Now Data-Driven From settings.standings_zones

Replaced the export page's hardcoded "UCL places / Europa places" league-table borders and legend with the same per-tournament zone logic the public standings uses, so any future league's promotion/relegation zones are picked up automatically instead of being hard-coded. Follow-up on the two-division standings work in `.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md` (zones live in `settings.standings_zones`, consumed via `lib/standings-core.ts`).

## Problem

The admin export (`app/(admin)/admin/export/page.tsx`) still rendered league standings with the **pre-division** hardcoded borders:

```ts
mode === 'league'
  ? pos < 12 ? 'var(--color-accent)'   // "UCL places"
  : pos < 20 ? '#3b82f6'               // "Europa places"
  : 'transparent'
```

and a static "UCL places / Europa places" legend. This is exactly the hardcoding that `.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md` removed from the **public** standings page (which now colours rows from `settings.standings_zones` via `rowZone`/`zoneLegend` in `lib/standings-core.ts`). As a result the export was NOT mirrored with the public standings: Division 1 (Betway Premiership, `{ bottom_yellow: 2, bottom_red: 3 }`) lost its relegation red/yellow rows, and Division 2 (Motsepe Foundation Championship, `{ top_green: 3, top_yellow: 2 }`) lost its promotion green rows — the export instead painted nothing unless a club sat in the top 12, and always claimed "UCL/Europa places".

## Fix

In `app/(admin)/admin/export/page.tsx`:

- Imported `normalizeStandingsZones`, `rowZone`, `zoneLegend` and the `StandingsZones` / `ZoneKind` types from `@/lib/standings-core` (the same single source of truth the public standings uses).
- Added inline-style zone colour maps (the export canvas is inline CSS, not Tailwind) matching `ZONE_BORDER_CLASS` colours from `lib/standings-core.ts`:
  - `ZONE_COLOR[zone]`: `top_green` → `#10b981` (emerald-500), `top_yellow`/`bottom_yellow` → `#facc15` (yellow-400), `bottom_red` → `#ef4444` (red-500).
  - `ZONE_SWATCH_COLOR[color]` for the legend dots (`green`/`yellow`/`red`).
- `StandingsTable` now takes an optional `zones?: StandingsZones | null` prop. For `mode === 'league'` it computes `rowZone(zones, pos, rows.length + offset)` and applies `ZONE_COLOR[zone]` as the row's left border; without zones (a league that defines none) rows render transparent, same as the public page.
- Added a small `StandingsLegend` component that renders `zoneLegend(zones)` dynamically (Promotion / Promotion playoff / Relegation playoff / Relegation), replacing the hardcoded UCL/Europa legend in both the non-chunked and chunked league-table render paths. Group standings are unaffected (they still show the top-N-qualify marker from `qualifiers_per_group`).

Because the zones come from `tournaments.settings.standings_zones` (already populated — verified live: D1 `{bottom_red:3,bottom_yellow:2}`, D2 `{top_green:3,top_yellow:2}`), this is future-proof: any new league created via the two-division flow automatically gets the correct promotion/relegation borders in exports with zero hardcoding.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint --file "app/(admin)/admin/export/page.tsx"` shows only the pre-existing unused-arg warning at line ~1023 (`mi`), unrelated to this change.
- `npx next build` succeeds.
- Confirmed via `npm run db` that both active 2026 league tournaments carry `settings.standings_zones`; the export now reads them.

## Notes

- The orphaned export `_desktop.tsx` / `_mobile.tsx` / `_shell.tsx` (unimported dead code, per `.opencode/context/admin-dashboard/export-vacant-team-logo-placeholder_2026-09-10.md`) still contain the old hardcoded league borders. Left untouched — if ever wired in, they must switch to the same `rowZone`/`zoneLegend` calls.
- The old `#3b82f6` "Europa places" colour is fully gone from the export league rendering; a tournament with no `standings_zones` shows neutral rows (public standings behaves identically).