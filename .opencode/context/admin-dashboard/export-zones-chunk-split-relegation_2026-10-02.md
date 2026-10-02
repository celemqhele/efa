# Export Standings: Relegation Zones Wrong on Split Images

Fixed the export painting relegation and relegation-playoff colours on mid-table clubs. The zones are computed against the full 16-team table, but the export splits long league tables into a FIRST HALF and SECOND HALF image, so the first image was asked to colour its bottom rows as if they were the bottom of the league. Follow-up to `.opencode/context/admin-dashboard/export-standings-zones-data-driven_2026-09-30.md`, which introduced the zone colours but sized them from the wrong array.

## Problem

`StandingsTable` computed its zone total from the rows it was handed:

```ts
const pos = i + offset
rowZone(zones, pos, rows.length + offset)
```

`rows.length + offset` is only the true table size for the **last** chunk. For the first chunk it is half the real total, so `rowZone`'s `index >= total - bottom_red` fired far too early.

`rowZone(zones, index, total)` in `lib/standings-core.ts` expects a 0-based **full-table** index and the **full-table** count. It was being given per-chunk numbers.

Live effect on Betway Premiership (`bottom_yellow: 2, bottom_red: 3`, 16 clubs, split 8/8):

| Image | Tags produced | Correct |
| --- | --- | --- |
| FIRST HALF | positions 4-5 playoff, **6-8 relegation** | nothing |
| SECOND HALF | 12-13 playoff, 14-16 relegation | correct |

Five mid-table clubs were tagged. Division 2 (`top_green: 3, top_yellow: 2`) was **accidentally correct**, because top zones depend only on `index` and never on `total` — which is why the bug looked relegation-specific.

The legend was also rendered unfiltered on **both** chunks, so the first-half image advertised "Relegation" and "Relegation playoff" over rows that (correctly) had no colour at all.

## Fix

In `app/(admin)/admin/export/page.tsx`:

- `StandingsTable` takes an optional `total` prop and passes `total ?? rows.length + offset` to `rowZone`. The fallback keeps the non-chunked path correct, since there the rows *are* the whole table.
- Both league chunks carry `standingsTotal: leagueStandings.length`, so every chunk judges its rows against the real table size.
- `StandingsLegend` takes an optional `present?: ZoneKind[]`. `zonesPresentInChunk` walks the chunk's rows with the same `rowZone` maths and the legend drops any zone that does not actually appear on that image, so each exported picture is self-consistent.
- Group standings are untouched (still the top-N-qualify marker from `qualifiers_per_group`).

## Verification

- `npx tsc --noEmit` clean; `eslint` 0 errors (1 pre-existing `mi` unused-arg warning at line ~1067); `next build` succeeds.
- `.recycle/tmp-verify-export-zones_2026-10-02.ts` replayed the maths against the real zone settings for both live divisions, comparing chunked output to a single pass over the full table:
  - Before: Division 1 MISMATCH, 5 wrong tags on positions 4-8.
  - After: both divisions match the full table exactly.
  - Odd-size case also checked (15 clubs split 8/7) since `halfCount = Math.ceil(n / 2)` makes the chunks unequal: tags land on 11-15, correct.
- Confirmed via `npm run db` that both active 2026 leagues still carry `standings_zones`.

## Notes

- The orphaned export `_desktop.tsx` / `_mobile.tsx` / `_shell.tsx` (dead code per `.opencode/context/admin-dashboard/export-vacant-team-logo-placeholder_2026-09-10.md`) still contain the pre-division hardcoded league borders, as noted in the 2026-09-30 file. Still untouched.

## Restore File Section

- `scripts/tmp-verify-export-zones.ts` — read-only replay of the export zone maths proving the
  chunking bug and the fix. Moved to `.recycle/tmp-verify-export-zones_2026-10-02.ts`.