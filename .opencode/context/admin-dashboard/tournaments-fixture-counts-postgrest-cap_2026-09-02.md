# Admin Tournaments — Fixture Counts Wrong (PostgREST 1000-row Cap)

## Intro
Fixed wrong Tournament card stats ("Fixtures 3 / Played 2" instead of the correct
"96 / 22") on `/admin/tournaments` by scoping the fixture/participant count queries
to the page's tournaments, matching the pattern already used by `/admin/dashboard`.

## Problem
The user reported that the EFA International Cup card on
`https://efa-fxyk.vercel.app/admin/tournaments` showed Teams 32 / Fixtures 3 /
Played 2, while the same tournament's card on `/admin/dashboard` correctly showed
32 / 96 / 22 / Progress 23%. Teams matched on both; only fixture-derived numbers
were wrong.

Root cause: Supabase's REST API (PostgREST) caps a response at **1000 rows** by
default. The tournaments `page.tsx` fetched fixtures with an unfiltered
`.from('fixtures').select('tournament_id, status, round_type')`, and the `fixtures`
table has **1408 rows**. PostgREST returned only the first 1000 (by key/insertion
order); the EFA International Cup's fixtures were created late, so just 3 of its 96
rows fell inside the 1000-row window → counts were truncated to 3/2.

The dashboard page was correct because it only queries fixtures for its active
tournaments via `.in('tournament_id', tournamentIds)`, keeping the result far under
the cap.

## Fix
`app/(admin)/admin/tournaments/page.tsx`: after fetching the tournament list, build
`tournamentIds` and filter both the participant and fixture count queries with the
same `.in('tournament_id', tournamentIds)` guard used by
`app/(admin)/admin/dashboard/page.tsx`, with a `tournamentIds.length ?` guard so
empty lists short-circuit to empty data.

```ts
const tournamentIds = ((tournaments ?? []) as any[])
  .map((t: any) => t.id)
  .filter((id: any): id is string => typeof id === 'string' && id.length > 0)

const { data: fixtures } = tournamentIds.length
  ? await supabase
      .from('fixtures')
      .select('tournament_id, status, round_type')
      .in('tournament_id', tournamentIds)
  : { data: [] }
```

No visible layout/UI change — the card grid from
`.opencode/context/admin-dashboard/tournaments-table-to-card-grid_2026-09-02.md`
is untouched.

### Files changed
- `app/(admin)/admin/tournaments/page.tsx`

## Notes / Gotchas
- `tournament_participants` (177 rows) was under the cap so Teams already matched
  (32), but it was filtered the same way for consistency and safety.
- RLS is not involved — `fixtures` has `fixtures_select_all` (SELECT for all), so a
  user-scoped `createClient` sees the same rows as the admin client.
- Any future unfiltered `.select()` over tables with >1000 rows has the same flaw;
  prefer `.in()` scoping or `.limit()`.
- Verified with SQL: `SELECT COUNT(*) FROM fixtures` → 1408; the international cup
  alone has 96 (22 confirmed), matching the dashboard. `npx tsc --noEmit` and
  `npm run build` pass; build-regenerated `public/sw.js` reverted before commit.

## Related files
- Follow-up to the card-grid redesign:
  `.opencode/context/admin-dashboard/tournaments-table-to-card-grid_2026-09-02.md`.
- The correct reference pattern lives in
  `app/(admin)/admin/dashboard/page.tsx` (`.in('tournament_id', tournamentIds)`).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |