# Sacked-club slot reclaim + phantom "Unknown team" fix

## Intro
Fixed the "club split" bug in user-based (slot-owned) competitions: assigning a manager to a club that had been sacked earlier only set `teams.manager_id` and never refilled the club's seat that `vacateUserSlots` had vacated — so in the EFA International Cup, Canada turned into a Vacant seat (no stats) plus a phantom 5th "Unknown team" group row built from its already-played fixtures, and the same latent bug sat on the Algeria/NAITOR seat. The fix tracks which club a vacated seat belonged to (`vacated_from_team_id`), adds `reclaimManagerSlots` to every assign path so a newly-assigned manager reclaims their club's seat automatically, and hardens `buildLiveStandings` so it can never fabricate phantom rows. The user reported this after the vacate restamp work in `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md` — the seat still split despite that restamp because the assign path never re-linked the seat to the incoming manager.

## Problem
- **Root cause (confirmed via `audit_log`)**: 2026-09-04 03:46:08 `sack_manager` on Canada (`slots_vacated: 1`, sacked qtn_blitz `30637e9f-9a05-4c0b-b7f9-e2972612cd73`) → `vacateUserSlots` made the seat Vacant (`user_id` null, `team_id` → Vacant placeholder `820ea628-d202-473d-8d75-62cac670f135`). 2026-09-04 03:46:30 `assign_manager` gave the Canada club to jigsaw_rsa (`a83cecc6-5cb7-4238-8d8c-2362e9e0590d`) but **only set `teams.manager_id`** — the slot model from `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md` was never served: the tournament seat was not refilled.
- **Phantom row mechanics**: Canada's 2 confirmed games (0-3 vs Spain, 6-4 vs Brazil) still referenced team `2c4a51fa-4b64-4765-95db-5ac102b7146e`. `buildLiveStandings` keyed rows by `team_id` only, had no participant lookup, and any team not in the group map fell through a `|| 'A'` fallback → a "Unknown team" row (lucide ShieldQuestion, actually Canada's stats) appeared in Group A, leaving Group F with 4 real teams + a Vacant seat instead of 4 owned seats.
- **Same big class on Algeria**: NAITOR (`e36f49c5-f16d-43d0-823d-e318fa8e8f99`) managed Algeria (`3241dc70-7674-4662-9cbc-b3f0471e93d4`) but the slot had `user_id` null — exactly the state that would "split" the same way once Algeria had played fixtures.

## Fix
- **Migration `supabase/migrations/072_track_vacated_from_team.sql`** (applied via `npm run db --`): adds `tournament_participants.vacated_from_team_id uuid REFERENCES teams(id) ON DELETE SET NULL` + partial index `(tournament_id, vacated_from_team_id) WHERE vacated_from_team_id IS NOT NULL`. Column records which club a vacated slot used to represent (vacate rewrites `team_id` → Vacant, losing that identity). Backfill deliberately empty — historical broken seats are repaired by the one-off script.
- **`lib/slot-utils.ts`**:
  - `vacateUserSlots` now selects `id, tournament_id, team_id` per slot and sets `vacated_from_team_id: slot.team_id` whenever the seat still showed a real club (skipped when `team_id` already equals the Vacant placeholder).
  - `fillVacantSlot` now clears the marker: `{ user_id, team_id: displayTeamId, vacated_from_team_id: null }`.
  - New **`reclaimManagerSlots(db, managerUserId, clubTeamId)`**: for every `status = 'active'` tournament, finds the club's free seats (`.is('user_id', null)` + `.or('team_id.eq.<club>,vacated_from_team_id.eq.<club>')`), refills them (`{ user_id, team_id: clubTeamId, vacated_from_team_id: null }`), restamps pending fixtures (`scheduled`, `awaiting_confirmation`, `confirmed_pending`) home/away `team_id` → club, and restamps `standings` + `group_standings` `team_id` → club. Played (confirmed) fixtures keep the club that actually played. Returns the reclaimed count.
- **Reclaim wired into all assign paths** (called after the tenure club binding is in place):
  - `app/api/admin/managers/assign/route.ts` (admin web assign)
  - `app/api/webhook/route.ts` → `applyManagerAssignment` (WhatsApp)
  - `app/api/admin/manager-applications/approve/route.ts` (web application approval)
- **`lib/standings-core.ts` → `buildLiveStandings` hardened**: participants select adds `id`; fixtures select adds `home_participant_id, away_participant_id`; a `participantById` map plus a new `resolveSide(teamId, participantId)` resolve the row's club/group from the *seat's current participant* first, falling back by the copied team id, and returning null (row skipped) when neither the seat nor the copy can be placed — making phantom "Unknown team" rows impossible.
- **One-off repair `scripts/cup-slot-repair.sql`** (applied via `npm run db --`):
  - Canada slot `5bbfef70-eb55-4a8e-93cc-097784a7cccc`: `user_id` → jigsaw_rsa `a83cecc6-5cb7-4238-8d8c-2362e9e0590d`, `team_id` → Canada `2c4a51fa-4b64-4765-95db-5ac102b7146e`, `vacated_from_team_id` null; restamps its `group_standings` + `standings` rows and its 4 pending fixtures (Vacant → Canada).
  - Algeria slot `c2ed7813-666b-495e-84c3-c33d0f1546a2`: `user_id` → NAITOR `e36f49c5-f16d-43d0-823d-e318fa8e8f99`.
  - Per user instruction, the 4 `confirmed_pending` auto-forfeit results ("Vacant slot absent — automatic 0-3") are left in place — they flip to `confirmed` and apply on their fixture days via the existing `flip-pending` cron, and the 2 confirmed Canada games stay as history.

## Verification
- `npx tsc --noEmit`: clean (fixed a `slotIds` reference left dangling when `vacateUserSlots` went per-slot). `npm run lint`: no new warnings. `npm run build`: succeeds.
- Full recalc of the International Cup (`recalculateStandings`, tournament `e2c61a3e-072e-4a07-8024-76de20c2a99a`): `groupRowsWritten: 32` — all 8 groups exactly 4 rows, no Unknown/Vacant anywhere. Group F: Spain (6/2), Canada (0/2), Brazil (6/2), Algeria (0/2) — Canada back in its seat with its 2 played games intact.
- Live queries confirm slot `5bbfef70` owner = jigsaw_rsa, club = Canada; Group F has 4 participants, no Vacant seat; slot's `group_standings` = Canada P2 W0 D0 L2 GF4 GA9 Pts0.

## Restore File Section
- `scripts/_tmp_cup-recalc.ts` → moved to `.recycle\_tmp_cup-recalc.ts_2026-09-05.ts` (one-off recalc smoke for the cup after the data repair; restore with `git checkout` if needed).

## Cross-references
- Slot model this builds on: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`
- Vacate restamp + auto-forfeit this follows up on: `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`
- Verify-create NAITOR gave Algeria its club: `.opencode/context/user-management/create-naitor-user-and-assign-algeria_2026-08-31.md`
- Manager assignment paths (WhatsApp) this reclaims into: `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`

## Notes / follow-ups
- The email/WhatsApp assign paths now reclaim seats automatically, so fresh sacks can no longer split a club. Seats already broken before this fix are repaired by re-running the club's assign (reclaim covers `team_id` match too) or by the one-off repair pattern.
- Housekeeping: added the `user-based-competitions/` category to the category-folder list in `AGENTS.md` (the folder existed on disk since 2026-08-30 but was missing from the list).
- `vacated_from_team_id` also enables a future "reopen the exact seat claim" when a club is retired/renamed (column survives club renames since it stores the team id reference).