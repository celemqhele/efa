# Poll eFootball Filter Type Error Fix — 2026-08-16

Fixed a Vercel build failure (`npm run build` → type error) in the poll page.

## Problem

`app/(public)/polls/[share_code]/page.tsx` passed `filterTeams(l.teams)` where `l.teams` is `TeamEntry[]` from `buildRegistry` (`lib/registry.ts`). `TeamEntry` is shaped as `{ slug, name }`, but `filterTeams` (`lib/allowed-teams.ts`) requires each team to carry `logo_league_folder` + `logo_team_slug`. TypeScript rejected the call:

```
Argument of type 'TeamEntry[]' is not assignable to parameter of type '{ logo_league_folder: string; logo_team_slug: string; }[]'.
```

The league folder lives on the parent registry entry (`l.folder`), not on each team.

## Fix

- Added `filterTeamsByFolder(folder, teams)` to `lib/allowed-teams.ts` — filters a league's teams by pairing the parent league folder with each team's `slug` via `isAllowedTeam`.
- Updated `app/(public)/polls/[share_code]/page.tsx` to use `filterTeamsByFolder(l.folder, l.teams)` in both the `allowed_leagues` branch and the international branch.
- Unchanged: the other `filterTeams` call sites (season wizard, admin team management, webhook) pass DB rows that genuinely carry `logo_league_folder`/`logo_team_slug`.
- Verified with `npm run build` (compiles and typechecks cleanly).
