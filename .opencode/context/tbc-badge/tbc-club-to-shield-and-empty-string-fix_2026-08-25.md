# TBC Badge Fix: Club → Shield icon + empty-string fallback — 2026-08-25

Follow-up to `.opencode/context/tbc-badge/tbc-club-badge-for-null-teams_2026-08-25.md`. Two fixes after deploying to production.

## Problem 1: Icon looked like a clover
The Lucide `Club` icon is a playing-card club suit (clover shape), not a football club badge/crest. User wanted a shield/crest shape instead.

## Fix 1: Club → Shield
- `components/ui/TeamLogo.tsx`: Swapped `Club` import and usage to `Shield` (lucide-react)
- `app/(admin)/admin/export/page.tsx`: Same swap in `TeamLogoInline`

## Problem 2: "TBC" text not showing on manage fixtures page
`cleanTeamName(null | undefined)` returns `''` (empty string), not `null`. The `??` (nullish coalescing) operator only triggers on `null`/`undefined`, so `'' ?? 'TBC'` evaluates to `''` — the TBC text never appeared.

## Fix 2: `??` → `||` for display fallbacks
Changed all display-facing `cleanTeamName(...) ?? 'TBC'` to `cleanTeamName(...) || 'TBC'` in:
- `app/(admin)/admin/fixtures/manage/_desktop.tsx` (2 sites)
- `app/(admin)/admin/fixtures/manage/_mobile.tsx` (2 sites)

The `?? ''` and `?? null` patterns left unchanged — those are prop-passing to child components, not display.

## Verification
- `npx tsc --noEmit` — clean
