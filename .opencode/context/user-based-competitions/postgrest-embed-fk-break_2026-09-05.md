# PostgREST embed break from 072's second FK — standings collapsed to one group

## Intro
Follow-up to `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`: after migration 072 added `tournament_participants.vacated_from_team_id` with a `REFERENCES teams(id)` FK, the live standings page collapsed to a single "Group A" table of 32 "Unknown team" rows. The user asked whether something must be pushed for the earlier fixes to take effect — investigation showed they were right that the code wasn't deployed, but the immediate "one standings" regression was a live **PostgREST embed failure** caused by the second FK, and it is fixed without any code deploy via migration 073.

## Problem
- Migration 072 created TWO FKs from `tournament_participants` → `teams` (`team_id` and new `vacated_from_team_id`). PostgREST cannot auto-resolve an embed like `team:teams(...)` when more than one relationship links the same two tables, so every `tournament_participants` → `teams` embed starts erroring.
- Only two app queries embed `teams` from `tournament_participants`: `lib/standings-core.ts:210` (`buildLiveStandings`, public standings page) and `app/api/webhook/route.ts:2588` (WhatsApp team listing).
- Because the embed 400'd, supabase-js returned `participants = null`; the deployed `buildLiveStandings` then ran its `teamGroupMap[...] || 'A'` fallback on every confirmed group fixture → all 32 teams bucketed into a single `'A'` with no team data → one table of 32 "Unknown team" rows, sorted as a merged table. Confirmed by fetching the live page: 1 group header, 32 "Unknown team" hits, 0 real names.
- RLS was never the problem (policies `tp_select_all` / `teams_select_all` are `qual = 'true'`); data was clean (8 groups × 4, no stale fixture team refs). The breakage came purely from the schema-cache relationship resolution.
- Repo precedent: `fixtures` has two FKs to `teams` and the code disambiguates embeds with `!fixtures_home_team_id_fkey` / `!fixtures_away_team_id_fkey` everywhere. The duplicate-FK anti-pattern is also discussed in `.opencode/context/postgrest-embeds/unique-constraint-one-to-one-embed-shape_2026-08-24.md` (different symptom, same root: PostgREST relationship derivation).

## Fix
- **`supabase/migrations/073_drop_vacated_from_team_fk.sql`** (applied via `npm run db --`): `ALTER TABLE public.tournament_participants DROP CONSTRAINT IF EXISTS tournament_participants_vacated_from_team_id_fkey;`
  - Keeps the `vacated_from_team_id` **column** and the partial reclaim **index** (`tournament_participants_vacated_from_team_idx`) that `reclaimManagerSlots` in `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md` relies on.
  - Dropping the FK cost is negligible: reclaim/fill always set the column to null on refill, and it is only ever matched against existing clubs, so `ON DELETE SET NULL` was not load-bearing.
  - PostgREST re-resolves schema on DDL automatically; the live page healed without any code re-deploy.
- Alternative considered and rejected: disambiguate every embed to `team:teams!tournament_participants_team_id_fkey(...)` and keep the FK — more churn, easy to miss a future embed site, and the tracking column does not need referential integrity. Dropping the FK fixes present and future embeds globally.
- The pending code hardening from the slot-reclaim change is retained: once the embed works, `buildLiveStandings` resolves sides via the slot's participant; and if a participant read ever fails again, `resolveSide` returns null → rows are skipped → the page shows "No teams found" instead of fabricating a merged "Group A".

## Verification
- `pg_constraint` on `tournament_participants` now lists a single FK to `teams` (`tournament_participants_team_id_fkey`); the `vacated_from_team_id` column and `tournament_participants_vacated_from_team_idx` index remain.
- Re-fetched the **live** page `https://efa-fxyk.vercel.app/standings?tournament=e2c61a3e-072e-4a07-8024-76de20c2a99a` (no push/deploy yet — only the DB change): **8 group headers, 0 "Unknown team", 0 "Vacant"**, real team names throughout, Canada present in Group F with its 2 played games. Confirms the diagnosis and the fix at the DB layer.
- `npx tsc --noEmit` / lint / build all still clean (no code changed in this step beyond the new migration file).

## Restore File Section
- (none — only a migration file added this step)

## Cross-references
- Chain root (why the column exists): `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`
- PostgREST relationship-derivation class of bugs: `.opencode/context/postgrest-embeds/unique-constraint-one-to-one-embed-shape_2026-08-24.md`
- Slot model that introduced `tournament_participants.team_id` embeds: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`

## Notes / follow-ups
- The working-tree code changes from the slot-reclaim work (standings hardening, `reclaimManagerSlots`, three assign-path wirings) are still **not deployed**; they must be committed + pushed for Vercel to rebuild. The DB-level portion (072 column/index, 073 FK drop, cup-slot repair, recalc) is already live.
- Future guidance: do not add a second FK from a table to a table it already references unless the embed sites are disambiguated with `!constraint_name` (see the `fixtures` pattern).