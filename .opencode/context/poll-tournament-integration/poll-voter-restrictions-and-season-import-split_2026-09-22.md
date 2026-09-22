# Poll Voter Restrictions + Season-Creator Import Div Split — 2026-09-22

Added `voter_restrictions` (JSONB allowlist `user_id → [league_folder,...]`) to the poll system so a poll can be restricted to a fixed set of eligible managers with per-user league visibility, enforced on the public share page (filter + ineligible notice) and server-side on apply, and extended the SeasonManager "Import from Poll" button so restricted placement polls drop managers straight into the correct Division 1 / Division 2 slots instead of the currently-active division. The eligible-voter list for the new EFA season is exactly the 32 managers of the EFA International Cup (tournament `e2c61a3e-072e-4a07-8024-76de20c2a99a`), split by group-stage ranking into top 16 (Betway Premiership) and bottom 16 (Motsepe Foundation Championship + ABC Motsepe League). Follow-up to `.opencode/context/poll-tournament-integration/poll-tournament-integration_2026-09-02.md` (season-linked polls) and `.opencode/context/two-divisions/psl-motsepe-placement-announcement_2026-09-21.md` (the 32-manager placement ranking this poll encodes).

## Problem
- Polls had no way to say "only these specific users may apply" — any authenticated user could claim any team in `allowed_leagues`. The new PSL/Motsepe season needs a club-selection poll where only the 32 ranked EFA International Cup managers can pick, and each manager can only see/pick from the SA league their placement entitles them to.
- The SeasonCreator "Import from Poll" button (`app/(admin)/admin/seasons/SeasonManager.tsx` `ImportFromPollButton`) imported every poll applicant into the *currently-active* division, so importing the SA poll would have piled all 32 into one division. It needed to read the poll's placement split and fill Division 1 / Division 2 correctly.

## Fix / Actions

### DB (migration `supabase/migrations/075_add_poll_voter_restrictions.sql`)
- `ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS voter_restrictions jsonb;` + GIN index `polls_voter_restrictions_idx`.
- Semantics: `null`/absent = open to any authenticated user (legacy); present = only users in the map can apply, each only to teams whose `logo_league_folder` is in their allowed folder list.

### Admin create API (`app/api/admin/polls/route.ts`) + admin page (`app/(admin)/admin/polls/page.tsx`)
- POST accepts `voter_tournament_id` + `voter_psl_count`. Given a tournament, it ranks participants via `rankTournamentManagers` and builds `voter_restrictions` with `buildPlacementRestrictions` (top N → `[SA_PREMIERSHIP_FOLDER]`, rest → `[SA_MOTSEPE_FOLDER, SA_ABC_FOLDER]`).
- Admin create form gained "Restrict voters (optional)" — tournament `<select>` (loaded from `/api/admin/tournaments`) + "PSL quota (top N)" number input. `LEAGUE_OPTIONS` in the admin page now includes the 3 SA leagues.

### Helper (`lib/poll-voter-restrictions.ts`)
- `SA_PREMIERSHIP_FOLDER` / `SA_MOTSEPE_FOLDER` / `SA_ABC_FOLDER` constants.
- `rankTournamentManagers(db, tournament_id)` — joins `group_standings` (points, goal_difference, goals_for) → `tournament_participants` user mapping, sorts points DESC → goal_difference DESC → goals_for DESC (matches `lib/standings-core.ts` `sortStandingsRows`, same basis as the placement PDF).
- `buildPlacementRestrictions(ranked, { psl_count, top_leagues, bottom_leagues })` — the placement split.
- `splitRestrictedUsersByDivision(restrictions, userIds)` — a user is Division 1 if their allowed folders include `SA_PREMIERSHIP_FOLDER`, else Division 2.

### Public share page (`app/(public)/polls/[share_code]/page.tsx`, `_desktop.tsx`, `_mobile.tsx`)
- Server computes `allowedFolders` for the signed-in user from `poll.voter_restrictions`, filters the league list down to those folders (both the season-linked pickable path and the registry path), sends `isEligible` to the client, and strips `voter_restrictions` from the poll payload exposed on the page.
- `_desktop.tsx` / `_mobile.tsx`: logged-in but ineligible users see an explanatory notice card ("This poll is restricted to tournament managers…") instead of the team list.
- Public GET `/api/polls/[share_code]/route.ts` also strips `voter_restrictions` from the poll it returns.

### Apply enforcement (`app/api/polls/[share_code]/apply/route.ts`)
- Poll select now includes `voter_restrictions`. If present: 403 if the user is not in the map, 403 if `team_league` is outside their allowed folders. Runs before both the season-linked and legacy branches.

### SeasonCreator import split (`app/(admin)/admin/seasons/SeasonManager.tsx`)
- `ImportFromPollButton` gained optional `onSplitSelect(d1, d2)`. For a poll with `voter_restrictions`, matched applicants are split via `splitRestrictedUsersByDivision` and passed to `onSplitSelect`, which sets `d1UserIds`/`d2UserIds` directly (switching to Division 1 tab). Polls without restrictions keep the legacy `onSelect` behavior.
- Poll rows in the import dialog show "Division split" when `voter_restrictions` is present; the "imported" toast reports `D1 n · D2 m`.

## Live poll created
- Ran `supabase/migrations/075_add_poll_voter_restrictions.sql` then inserted the poll **"2026 SA Club Selection"**, `share_code` **`f79b9129`**, `created_by` mubizamaan, `allowed_leagues` = the 3 SA league folders, `allowed_international` = false, standalone (no `season_id` — direct claim FCFS), `voter_restrictions` built from live group_standings of tournament `e2c61a3e-072e-4a07-8024-76de20c2a99a`.
- Verified: exactly **32** voters in the map, split **16 Premiership / 16 Motsepe+ABC**.

## Verification
- `npx tsc --noEmit` clean. `next lint` on touched files: only pre-existing unused-var warnings (`LeagueEntry`, `handleExportManager`). Confirmed poll row + restriction counts via `npm run db`.

## Notes / Caveats
- No deletion involved → no Restore File Section.
- `voter_restrictions` deliberately stripped from public poll payloads (share page + GET) to avoid leaking the allowlist to non-members; the admin polls GET still returns it (admins need it for the import split).
- The `CreateTournamentClient.tsx` copy of `ImportFromPollButton` was left unchanged (it targets tournament slot-filling, not season divisions).

## Context chain (by path)
- Placement ranking this poll encodes: `.opencode/context/two-divisions/psl-motsepe-placement-announcement_2026-09-21.md`
- Season-linked poll wiring: `.opencode/context/poll-tournament-integration/poll-tournament-integration_2026-09-02.md`
- Original "Import from Poll" button: `.opencode/context/user-based-competitions/tournament-creation-user-slots-frontend_2026-09-02.md`
- Standings sort basis: `lib/standings-core.ts` `sortStandingsRows` (reflected in `rankTournamentManagers`)