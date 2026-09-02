# TBC Club Badge for Null Teams — 2026-08-25

Replaced null/missing team slots in fixtures with a Lucide `Club` icon + "TBC" text across all admin and public pages.

## What changed

### `components/ui/TeamLogo.tsx`
- Added `Club` import from `lucide-react`
- Exported new `TBCBadge` component: renders a Lucide `Club` icon (className-sized, `text-text-muted`, strokeWidth 1.5)
- Existing `TeamLogo` and `ShieldQuestion` (No Name placeholder) unchanged

### Admin manage fixtures (`app/(admin)/admin/fixtures/manage/`)
- `_desktop.tsx`: Home/away team slots now render `TBCBadge` when `homeTeam`/`awayTeam` is null, instead of skipping the logo entirely
- `_mobile.tsx`: Added `TeamLogo` rendering (was text-only before) with `TBCBadge` fallback for null teams

### Public home page (`app/`)
- `_desktop.tsx`: Upcoming fixtures + latest results — null teams show `TBCBadge` instead of no logo
- `_mobile.tsx`: Same pattern

### Public fixtures list (`app/(public)/fixtures/`)
- `_desktop.tsx`: Opponent logo renders `TBCBadge` when opponent is null
- `_mobile.tsx`: Same in `FixtureCard`

### Public fixture detail (`app/(public)/fixtures/[id]/`)
- `_desktop.tsx`: Match hero (both has-result and no-result variants) — null teams render `TBCBadge` with "TBC" name and no link wrapper. Pre-match sections (Coach Analysis, Matchroom, Probability, H2H, DNA, Form) and Score Submission wrapped with `homeTeam && awayTeam` null guards
- `_mobile.tsx`: Same hero treatment. Pre/post-match sections and confirmation status wrapped with null guards

### Public results list (`app/(public)/results/`)
- `_desktop.tsx`: Opponent logo renders `TBCBadge` when null
- `_mobile.tsx`: Same in `ResultCard`

### Admin export page (`app/(admin)/admin/export/page.tsx`)
- `TeamLogoInline`: Returns `Club` icon sized to prop when `folder`/`slug` missing (was `return null`)

## Key IDs
- No new DB entities — purely UI-layer change
- `TBCBadge` uses Lucide `Club` icon (playing card club suit shape)

## Deliberately unchanged
- `ShieldQuestion` placeholder for UEL "No Name" team (existing `getPlaceholderIcon` in `TeamLogo`) — see `.opencode/context/uel-no-name/uel-no-name-replacement_2026-08-16.md`
- No DB migrations needed
- Team auto-progression (`advanceWinner`) fills `home_team_id`/`away_team_id` in the DB; on next page load the real team replaces TBC automatically

## Related files
- `.opencode/context/uel-no-name/uel-no-name-replacement_2026-08-16.md` — the `ShieldQuestion` (No Name) placeholder this change deliberately leaves untouched; both render through `TeamLogo.tsx`/`getPlaceholderIcon`.
- `.opencode/context/tbc-badge/tbc-club-to-shield-and-empty-string-fix_2026-08-25.md` — follow-up: Club icon → Shield + empty-string TBC display fallback.

## Verification
- `npx tsc --noEmit` — clean
- `npm run lint` — warning-only (all pre-existing)
