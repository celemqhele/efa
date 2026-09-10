# Export: Vacant team logo now shows ShieldQuestion placeholder

Fixed the admin Export page so the Vacant placeholder team (and No Name) renders the ShieldQuestion icon instead of a broken image, matching the logo fallback used everywhere else via `components/ui/TeamLogo.tsx`.

## Problem

On the Export page (`app/(admin)/admin/export/page.tsx`), the inline `TeamLogoInline` helper only fell back to a generic icon when `folder`/`slug` were null. The Vacant placeholder team has real logo fields (`logo_league_folder = 'custom'`, `logo_team_slug = 'vacant'` — confirmed in the `teams` table), so the helper rendered `/logos/custom/128x128/vacant.png`, which doesn't exist → broken/empty image on exported fixtures/results/standings/managers cards.

The canonical placeholder logic in `components/ui/TeamLogo.tsx` (`getPlaceholderIcon`, lines 29–34) already handles this (`custom` + `vacant`/`noname` → lucide `ShieldQuestion`, `.text-text-muted`, strokeWidth 1.5). The export page duplicated its own logo rendering instead of reusing it (see `.opencode/context/uel-no-name/uel-no-name-replacement_2026-08-16.md` for where the ShieldQuestion fallback convention was established).

## Fix

In `app/(admin)/admin/export/page.tsx`:

- Imported `ShieldQuestion` from `lucide-react` (replaced the now-unused separate `Shield` import).
- In `TeamLogoInline` (~line 52), added an `isPlaceholder` check — `folder === 'custom' && (slug === 'vacant' || slug === 'noname')` — that renders the `ShieldQuestion` placeholder in the same span/box used for the null fallback (size × 0.75, strokeWidth 1.5). Non-placeholder clubs keep the existing `/logos/{folder}/128x128/{slug}.png` `<img>`.

## Notes

- `npx tsc --noEmit` passes; `npx next lint --file ...` reports only a pre-existing unused-arg warning (`mi` in the managers map, line 1008) unrelated to this change.
- The export dir also contains orphaned `_desktop.tsx` / `_mobile.tsx` / `_shell.tsx` (a newer ViewportSwitch-based generation). `page.tsx` does NOT import `_shell`, so they are dead code; they contain the same defect (`TeamLogoInline` there only special-cases `noname`, not `vacant`). Left untouched — if they are ever wired in, their `TeamLogoInline` must get the same `vacant` handling.
- Related export-page context: `.opencode/context/admin-dashboard/export-group-filter_2026-09-03.md`.