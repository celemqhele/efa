# Poll International Teams Empty — 2026-08-25

Admin created a poll with "Include international / national teams" checked. When opening the poll, no national teams were visible — the team list was completely empty.

## Root Cause

`lib/efootball-2027-teams.json` (the eFootball 2027 allowlist) only contained 3 club leagues (EPL, La Liga, Serie A). It had no entry for `fifa-world-cup-2026.football-logos.cc`.

When the poll view page (`app/(public)/polls/[share_code]/page.tsx`) built the team list:
1. `buildRegistry()` correctly found the World Cup folder and read all 49 national team PNGs
2. The poll's `allowed_international: true` correctly triggered inclusion of `isNational` entries
3. But `filterTeamsByFolder()` → `isAllowedTeam()` looked up the World Cup folder in the JSON, found nothing, and returned `false` for every team
4. All 49 national teams were stripped → empty array → nothing rendered

## Fix

Added the `fifa-world-cup-2026.football-logos.cc` folder with all 49 national team slugs to `lib/efootball-2027-teams.json`.

**Single file change**: `lib/efootball-2027-teams.json` — no code changes needed.

## Related Files
- `lib/efootball-2027-teams.json` — allowlist data (modified)
- `lib/allowed-teams.ts` — `isAllowedTeam()` / `filterTeamsByFolder()` (unchanged)
- `app/(public)/polls/[share_code]/page.tsx` — poll view, calls `filterTeamsByFolder` (unchanged)
- `lib/registry.ts` — `buildRegistry()` reads logo folders from disk (unchanged)
