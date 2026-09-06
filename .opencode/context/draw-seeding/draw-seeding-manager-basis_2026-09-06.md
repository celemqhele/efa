# Seeded draws now use manager record instead of team record

**Date:** 2026-09-06

Changed the automatic "Run Draw" group-stage seeding to rank by each manager's all-time career record (aggregated from `manager_tenures`) instead of each club's record (aggregated from `standings`), and the draw modal now lists the seeded managers by `@username`. The user reported the team-name basis was awkward because stats really belong to the manager and every manager's tenures are already auto-updated by the results trigger, so the seeding rank can be derived without the per-tournament `standings` aggregation. This follows the seeded draw work in `.opencode/context/draw-seeding/draw-seeding-club-records_2026-09-02.md`.

## Problem
- `lib/team-seeding.ts` `computeSeedRanks` aggregated per-team `standings` rows — team-based, not manager-based.
- `app/api/admin/tournament-draw/route.ts:42` mapped that rank back by `team_id`, so seeding ignored the actual human at the helm.
- Draw result response only returned group names + team counts, so the admin modal never showed who was seeded where.

## Fix
1. **New `computeManagerSeedRanks`** in `lib/team-seeding.ts` (old `computeSeedRanks` kept for legacy/team fallback):
   - Aggregates every `manager_tenures` row per `manager_id` (summing `wins/draws/losses/goals_for/goals_against`). Those columns are auto-maintained by the `results` trigger from `supabase/migrations/010_auto_manager_stats.sql` (fixed/retriggered in `054_fix_manager_stats_trigger.sql`).
   - Scores each manager by career **PPG = (3×wins + draws) ÷ played**, sorts PPG desc → wins desc → goal difference desc → goals_for desc, assigns rank 1, 2, 3…
   - Managers with zero completed tenures (played = 0) get no score and rank after every scored manager (bottom pot, UEFA no-coefficient style).
2. **`app/api/admin/tournament-draw/route.ts`**:
   - Participants now select `team:team_id(id, name, manager_id)` plus the existing `user_id`.
   - Manager id per participant = `user_id ?? team.manager_id` (fallback for legacy rows without a user slot).
   - `computeManagerSeedRanks(db, managerIds)` returns a `Map<manager_id, rank>`; each participant's `rank` comes from `seedRanks.get(managerId) ?? 999`.
   - Usernames loaded from `profiles` in the same `Promise.all`; `teams[].label` is now `@username` (falls back to team name).
3. **`app/(admin)/admin/tournaments/RunTournamentDrawButton.tsx`**: group draw response now includes `teams: string[]` (the `@username` labels); the modal renders the seeded list under each group heading. Knockout result surface unchanged.

## Key details
- Only group-stage types (`tournament_club`, `tournament_international`) render Run Draw, and every participant in those is an account with `user_id`, so the manager mapping is 1:1.
- Knockout path is untouched — it seeds by group *position* (winners vs runners-up via `determineQualifiers`), not by rank, so manager-based ranks have no effect there (validated by simulation runs of `drawKnockoutRound` — 6/6 valid, no same-group rematch).
- Draw geometry (`createPots` / `drawGroups`) unchanged — only the rank source switched.
- Career PPG was soak-tested on live data from `manager_tenures` (top managers: Terrence 2.688 PPG, itumeleng_99 2.212, ghost 1.990, ayathaba 1.981; bottom example celemqhele 0.945 → bottom pot).

## Verification
- `npx tsc --noEmit` passes.
- `npm run lint` — clean on the three changed files.
- No unit-test framework in repo; the seeding math was validated by querying real `manager_tenures` aggregate data and running the `drawKnockoutRound` simulation in the terminal.