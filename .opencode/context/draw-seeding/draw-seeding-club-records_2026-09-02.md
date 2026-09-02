# Seeded Club Records Draw

**Date:** 2026-09-02

Seeded the manual "Run Draw" group-stage draw with each club's all-time record (PPG from `standings`) instead of defaulting every team to rank 0. Previously `app/api/admin/tournament-draw/route.ts` built teams with `rank: p.seed_pot ?? 0`, and nothing ever populated `seed_pot` for the Run Draw path — so every club was rank 0 and the draw was effectively a pure random shuffle.

## Problem
- `handleGroupDraw` in `app/api/admin/tournament-draw/route.ts:41-45` used `p.seed_pot ?? 0` as each team's seed rank; participants created outside `start-tournament` have no `seed_pot`, so all teams ranked 0.
- `createPots` / `drawGroups` only produce seeded (spread-the-strong) groups when ranks are distinct and ordered (lower = stronger, pot 0 first).
- `teams` has no stats columns; club records live in per-tournament `standings` rows (`played/wins/draws/losses/goals_for/goals_against/points`, schema `supabase/migrations/001_initial_schema.sql` lines 174-193), never aggregated anywhere.

## Fix
1. **New helper** `lib/team-seeding.ts` — `computeSeedRanks(db, teamIds)`:
   - Aggregates all `standings` rows for the given teams across every tournament (sum played/wins/points/GF/GA).
   - Scores each club by **PPG = points ÷ played**; clubs with `played = 0` get no score.
   - Sorts PPG desc → wins desc → goal difference desc → goals_for desc, assigns rank 1, 2, 3… (best = rank 1 → pot 0, one per group).
   - Clubs with no recorded stats are ranked after every seeded club → bottom pot (UEFA-style, like no-coefficient teams in pot 4).
2. **Wired into** `app/api/admin/tournament-draw/route.ts`: replaced the `rank` source with `seedRanks.get(p.team_id) ?? 999` from `computeSeedRanks`. Rest of `handleGroupDraw` unchanged (pots, `drawGroups`, group-name assignment, `group_name`/`seed_pot` write-back).
3. `start-tournament/route.ts` unchanged — it already seeds by league position (`seed_pot` from final standings).

## Key details
- Only `tournament_club` and `tournament_international` have group stages; the Run Draw button is only rendered for those types, so the seeding covers every group-stage tournament type.
- Uneven group sizes are fine: `drawGroups` caps at `ceil(teams/groupCount)` with no floor (e.g. 10 teams / 4 groups → 3/3/2/2), and pot disposition still spreads top seeds one per group.
- The geometry of the seeded group assignment is a random draw *within* each pot tier; only the pot membership is deterministic from club record.

## Known gap (not fixed)
`app/api/admin/generate-fixtures/route.ts:96` has a second group-assignment path: when `fixture_mode === 'groups'` it does `[...teamIds].sort(() => Math.random() - 0.5)` and overwrites every participant's `group_name`, discarding a previously-run seeded draw. Only in effect if an admin runs Run Draw and then generates fixtures via the "Generate Fixtures" button (the wrapper sends only `tournamentId` + `start_date`). `start-tournament` generates fixtures from the drawn groups directly, so it is unaffected.

## Verification
- `npx tsc --noEmit` passes.
- `npm run lint` — only pre-existing warnings plus the pre-existing `lib/phone.ts:24` error (unrelated to this change).
- No unit-test framework in repo; exercised by running the admin Run Draw on a real tournament.