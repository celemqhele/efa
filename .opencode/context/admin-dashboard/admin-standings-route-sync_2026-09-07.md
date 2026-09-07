# Admin Standings route — duplicate standings under admin mode, kept in sync

## Intro
Added an `/admin/standings` page that renders the exact same standings as the public `/standings` page (shared data loader + reused client components) and pointed both admin pill navs (desktop `AdminNavDesktop`, mobile `AdminTabBar`) at it — so clicking **Standings** in admin mode no longer drops the admin out of admin mode to the public manager-mode nav. All data fetching now flows through one loader, `loadStandingsPageData`, so the two pages can never drift apart.

## Problem
Per `.opencode/context/admin-dashboard/admin-nav-standings-swap_2026-09-07.md`, the admin nav's new **Standings** tab pointed at the public `/standings` route (`(public)` route group). Clicking it navigated outside `/admin`, so `Nav._desktop.tsx` / `BottomTabBar.tsx` (which switch the pill to admin mode only when `pathname.startsWith('/admin')`) flipped back to manager mode mid-use. Fix was to give standings its own admin-mode route — duplicating the page but keeping it synced to the same data.

## Fix
1. **`lib/standings-page.ts` (new)** — `loadStandingsPageData(supabase, selectedTournamentId)` extracts the exact fetch logic that was inside the public page (active tournaments + `buildLiveStandings`), returning `{ tournaments, activeTournamentId, activeTournament, leagueStandings, groupStandings }`. This is the single source of truth both pages call.
2. **`app/(public)/standings/page.tsx`** — slimmed to call `loadStandingsPageData` (logic removed; rendering unchanged).
3. **`app/(admin)/admin/standings/page.tsx` (new)** — same header + renders the shared `Shell` (imported from `@/app/(public)/standings/_shell`) fed by the same loader. `dynamic = 'force-dynamic'` so neither route caches stale data. The `(admin)` layout gate (`app/(admin)/layout.tsx`) already enforces admin-only access.
4. **`app/(public)/standings/_desktop.tsx` / `_mobile.tsx`** — the tournament switcher used hardcoded `/standings?tournament=...` links; both now build the URL from `usePathname()` (`${pathname}?tournament=...`) so switching competitions on `/admin/standings` stays in admin mode and on `/standings` stays public (consistent on both surfaces).
5. **`components/ui/AdminNavDesktop.tsx` / `components/ui/AdminTabBar.tsx`** — the `Standings` tab href changed `/standings` → `/admin/standings`.

## Notes / Gotchas
- Reusing the same `Shell`/`_desktop`/`_mobile` client components from the `(public)` route group and the shared loader is what keeps the two pages in sync — not a blind copy.
- Team-row clicks still navigate to the shared public `/teams/[id]` page (leaving admin mode for that visit is expected).
- Verified `npx tsc --noEmit`, `npm run lint` (only pre-existing warnings), `npm run build` (now emits `/admin/standings`); build-regenerated `public/sw.js` reverted before commit.

## Related files
- Prior swap commit: `.opencode/context/admin-dashboard/admin-nav-standings-swap_2026-09-07.md`.
- Standings core helpers reused: `lib/standings-core.ts`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |