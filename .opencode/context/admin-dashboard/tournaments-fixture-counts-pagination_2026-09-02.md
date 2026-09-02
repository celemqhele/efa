# Admin Tournaments — Fixture Counts Still Wrong (Need Pagination Past 1000)

## Intro
The first PostgREST cap fix (`.in()` scoping) reduced but did not remove the 1000-row
truncation on `/admin/tournaments` — the card still showed "Fixtures 3 / Played 2".
Fixed by paginating the fixtures fetch with `.range()` so all rows are retrieved.

## Problem
After the fix in
`.opencode/context/admin-dashboard/tournaments-fixture-counts-postgrest-cap_2026-09-02.md`
(scoping the fixture/participant queries with `.in('tournament_id', tournamentIds)`),
the user reported the EFA International Cup card on `https://efa-fxyk.vercel.app/admin/tournaments`
still showed Fixtures 3 / Played 2 while the dashboard card correctly showed 96 / 22.

Why scope-by-tournament-ids was not enough: PostgREST caps a single GET response at
1000 rows, and the page displays **all** tournaments (active + upcoming + completed).
Every fixture belongs to some tournament row, so `.in(...)` still matched **1408 rows**
(`SELECT COUNT(*) FROM fixtures WHERE tournament_id IN (SELECT id FROM tournaments)` → 1408),
which exceeds the cap — PostgREST only returned the first 1000, cutting off the
International Cup's late-inserted fixtures again (only 3 of its 96 made the window). The
dashboard page is unaffected because it only queries **active** tournaments (currently the
cup alone, 96 rows < 1000).

## Fix
`app/(admin)/admin/tournaments/page.tsx`: replaced the single unfiltered-cap-bearing
fixtures query with a paginated loop using `.range(from, from + PAGE_SIZE - 1)` and a
deterministic `.order('id', { ascending: true })` so pages are stable. The loop
accumulates rows and stops once a page returns fewer than `PAGE_SIZE` rows (with a
100k safety bound). Each page request stays at 1000 rows, i.e. under the PostgREST cap.

```ts
const PAGE_SIZE = 1000
const fixtureRows: any[] = []
if (tournamentIds.length) {
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('fixtures')
      .select('tournament_id, status, round_type')
      .in('tournament_id', tournamentIds)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    fixtureRows.push(...((data ?? []) as any[]))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
    if (from > 100_000) break
  }
}
```

Counts are then derived from `fixtureRows` exactly as before. Participant counts stay
with the plain `.in()` query (177 rows, under the cap).

### Files changed
- `app/(admin)/admin/tournaments/page.tsx`

## Notes / Gotchas
- `.range()` is the documented Supabase pagination mechanism for results larger than
  the 1000-row cap; each paged request stays ≤ 1000 rows so it is never rejected.
  `.order('id')` is required so re-fetching pages does not skip/duplicate rows.
- Any future page that `.select()`s a table with >1000 matching rows and needs all of
  them must paginate the same way — an unfiltered or loosely-filtered `.select()` will
  silently truncate at 1000.
- DB truth verified via SQL: `SELECT COUNT(*) FROM fixtures` → 1408; the International
  Cup (`e2c61a3e-072e-4a07-8024-76de20c2a99a`) has 96 fixtures, 22 confirmed — matching
  the dashboard card.
- `npx tsc --noEmit` and `npm run build` pass; build-regenerated `public/sw.js` reverted
  before commit.

## Related files
- Follow-up/correction to:
  `.opencode/context/admin-dashboard/tournaments-fixture-counts-postgrest-cap_2026-09-02.md`.
- Card-grid redesign that first surfaced these counts:
  `.opencode/context/admin-dashboard/tournaments-table-to-card-grid_2026-09-02.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |