# eFootball 2027 Team Restriction — 2026-08-16

Restricted all team-picking and assignment surfaces to only include clubs and national teams that exist in eFootball 2027 (v6.0.0).

- **Objective**: Prevent managers from picking/assigning clubs or national teams that do not exist in the actual eFootball 2027 roster.
- **Implementation**:
    - Created canonical allowed-teams dataset in `lib/efootball-2027-teams.json`.
    - Added filter utility `lib/allowed-teams.ts`.
    - Updated `lib/logo-resolver.ts` to include 2026-27/2027 league folders.
    - Applied `filterTeams` to:
        - Season wizard (`app/(admin)/admin/seasons/page.tsx`)
        - Admin team management (`app/(admin)/admin/managers/page.tsx`)
        - Webhook `getTeamsForAssignment` (`app/api/webhook/route.ts`)
        - Polls `buildRegistry` (`app/(public)/polls/[share_code]/page.tsx`)
- **Impact**: Non-game teams are now filtered out of selection UIs. Existing team assignments remain untouched.

## 2026-08-16 — Fix Vercel build type error

The poll page (`app/(public)/polls/[share_code]/page.tsx`) failed the Vercel build: `filterTeams` requires each team to carry `logo_league_folder` + `logo_team_slug`, but `buildRegistry` returns `TeamEntry[]` shaped as `{ slug, name }` with the league folder on the parent entry. Passed `TeamEntry[]` where `{ logo_league_folder; logo_team_slug }[]` was expected.

- **Fix**: Added `filterTeamsByFolder(folder, teams)` to `lib/allowed-teams.ts` — filters teams by pairing the parent league folder with each team's `slug` via `isAllowedTeam`.
- **Updated** `app/(public)/polls/[share_code]/page.tsx` to call `filterTeamsByFolder(l.folder, l.teams)` in both the league and international branches.
- Other `filterTeams` call sites (seasons, managers, webhook) pass DB rows that genuinely carry those columns and were unchanged.
- Verified with `npm run build` (compiles + typechecks cleanly).
