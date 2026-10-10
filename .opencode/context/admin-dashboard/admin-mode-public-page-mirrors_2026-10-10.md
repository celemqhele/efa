# Admin mode persists across public-facing pages (mirror routes + SmartLink)

Added admin mirror routes for every public-facing page the admin flow reaches, plus a
`SmartLink` wrapper that keeps internal navigation under `/admin` so the admin nav no
longer flips back to manager mode. This fixes the reported flow where an admin on the
fixtures-manage page clicked into a match/team/result and "go back" dropped them onto the
public "My Fixtures"/"My Results" pages instead of staying in admin. Follow-up to the
precedent set in `.opencode/context/admin-dashboard/admin-standings-route-sync_2026-09-07.md`
(admin standings already reused the public `_shell`), and it builds on the clickable-row
links created in `.opencode/context/admin-dashboard/admin-fixtures-manage-clickable-rows_2026-09-23.md`.

## Problem

Admin mode is chosen purely by pathname prefix: `components/ui/Nav._desktop.tsx` does
`if (isAdmin && pathname.startsWith('/admin')) return <AdminNavDesktop/>`, and
`components/ui/BottomTabBar.tsx` does the same for `AdminTabBar`. Every internal link on
the public pages (match detail, results, team profile, team fixtures, manager profile,
standings rows, fixtures-manage rows) pointed at **public** URLs, so the moment an admin
followed one of those links the URL left `/admin`, admin mode was lost, and the back
button landed on the public "My Fixtures" / "My Results" list.

Concretely the leaks were:

- `app/(admin)/admin/fixtures/manage/_desktop.tsx` / `_mobile.tsx`: rows linked to
  `/fixtures/<id>` (public).
- `app/(public)/results/[id]/_desktop.tsx` (~line 26) / `_mobile.tsx` (~line 40):
  hardcoded `<Link href="/results">` back link.
- `app/(public)/teams/[id]/fixtures/_desktop.tsx` (~line 135): `window.location.href =
  result ? /results/<id> : /fixtures/<id>` (hard nav, public).
- `app/(public)/standings/_desktop.tsx` / `_mobile.tsx`: team rows used
  `window.location.href = /teams/<id>` (hard nav, public).
- All the other converted shells linked to `/teams/...`, `/fixtures/...`, `/results/...`.

## Fix

1. **Admin mirror routes** re-export the public page module (identical data + metadata) so
   the same screen renders at an `/admin` URL, which keeps `pathname.startsWith('/admin')`
   true and therefore keeps the admin nav:
   - `app/(admin)/admin/fixtures/[id]/page.tsx`
   - `app/(admin)/admin/results/page.tsx`
   - `app/(admin)/admin/results/[id]/page.tsx`
   - `app/(admin)/admin/teams/[id]/page.tsx`
   - `app/(admin)/admin/teams/[id]/fixtures/page.tsx`
   - `app/(admin)/admin/managers/[id]/page.tsx`
   - `app/(admin)/admin/premiership/page.tsx`
   - `app/(admin)/admin/rules/page.tsx`

   Each is e.g. `export { generateMetadata, default } from '@/app/(public)/.../page'`
   with a local `export const dynamic = 'force-dynamic'` (mirrors the re-export pattern
   used by `app/(admin)/admin/standings/page.tsx`).

2. **`lib/admin-href.ts`** — `toAdminHref(href, isAdmin)`: when `isAdmin`, prefixes a
   fixed allow-list of public prefixes (`/fixtures`, `/results`, `/teams`, `/managers`,
   `/standings`, `/premiership`, `/rules`) with `/admin`; leaves `/admin/*`, external,
   hash and query-only paths untouched.

3. **`components/ui/SmartLink.tsx`** — a client drop-in for `next/link` that reads
   `usePathname()`, applies `toAdminHref`, and otherwise forwards all props to
   `next/link`. Swapped the `import Link from 'next/link'` for
   `import Link from '@/components/ui/SmartLink'` in the reachable shells:
   `app/(public)/fixtures/{_desktop,_mobile}.tsx`,
   `app/(public)/fixtures/[id]/{_desktop,_mobile}.tsx`,
   `app/(public)/results/{_desktop,_mobile}.tsx`,
   `app/(public)/results/[id]/{_desktop,_mobile}.tsx`,
   `app/(public)/standings/_mobile.tsx`,
   `app/(public)/teams/[id]/{_desktop,_mobile}.tsx`,
   `app/(public)/teams/[id]/fixtures/{_desktop,_mobile}.tsx`,
   `app/(public)/managers/[id]/{_desktop,_mobile}.tsx`, plus
   `app/(admin)/admin/fixtures/manage/{_desktop,_mobile}.tsx` (so the manage rows now go
   to `/admin/fixtures/<id>` instead of the public match page they used before
   `.opencode/context/admin-dashboard/admin-fixtures-manage-clickable-rows_2026-09-23.md`).

4. **Hard-navigations** that bypassed `<Link>` were switched to `toAdminHref`:
   `app/(public)/standings/_desktop.tsx` and `_mobile.tsx` team rows, and
   `app/(public)/teams/[id]/fixtures/_desktop.tsx` result/fixture rows.

Behavior on public URLs is unchanged — `SmartLink`/`toAdminHref` only rewrite when the
current pathname starts with `/admin`.

## Files

- New: `lib/admin-href.ts`, `components/ui/SmartLink.tsx`, and the 8 mirror pages under
  `app/(admin)/admin/`.
- Edited: the shells listed above (import swaps + `toAdminHref` in hard-nav handlers).

## Verification

- `npx tsc --noEmit` — clean.
- `npx next lint` — clean (only pre-existing warnings elsewhere).
- `npx next build` — succeeds; `.next/server/app/(admin)/admin/` contains the new
  `fixtures/[id]`, `results`, `results/[id]`, `teams/[id]`, `teams/[id]/fixtures`,
  `managers/[id]`, `premiership` and `rules` routes.
