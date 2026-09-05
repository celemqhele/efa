-- ============================================================
-- One-off repair: restore Canada + Algeria seats in the active
-- EFA International Cup after the sack/assign split.
-- Run via:  npm run db -- scripts/cup-slot-repair.sql
-- ============================================================
-- Context: sacking Canada's old manager vacated its Group F seat
-- (ownerless, team_id -> Vacant). Assigning jigsaw only set
-- teams.manager_id, never the seat — so the club "split" into a
-- Vacant seat plus phantom rows from its played fixtures.
-- NAITOR manages Algeria but its seat never got an owner either.

BEGIN;

-- ─── Canada: seat 5bbfef70 back to Canada + jigsaw_rsa ───
UPDATE public.tournament_participants
SET user_id = 'a83cecc6-5cb7-4238-8d8c-2362e9e0590d',  -- jigsaw_rsa
    team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e',   -- Canada
    vacated_from_team_id = NULL
WHERE id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc';

-- Stored group standings row already carries Canada's 2 played games;
-- only the team copy needs to flip back.
UPDATE public.group_standings
SET team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'   -- Canada
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc';

UPDATE public.standings
SET team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'   -- Canada
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc';

-- Upcoming fixtures for the slot: show Canada again (pending results,
-- statuses and participant refs are left untouched per user decision).
UPDATE public.fixtures
SET home_team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'   -- Canada
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND home_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc'
  AND home_team_id = '820ea628-d202-473d-8d75-62cac670f135'  -- Vacant
  AND status IN ('scheduled', 'awaiting_confirmation', 'confirmed_pending');

UPDATE public.fixtures
SET away_team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'   -- Canada
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND away_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc'
  AND away_team_id = '820ea628-d202-473d-8d75-62cac670f135'  -- Vacant
  AND status IN ('scheduled', 'awaiting_confirmation', 'confirmed_pending');

-- ─── Algeria: seat c2ed7813 gets its manager NAITOR as owner ───
UPDATE public.tournament_participants
SET user_id = 'e36f49c5-f16d-43d0-823d-e318fa8e8f99',  -- NAITOR
    vacated_from_team_id = NULL
WHERE id = 'c2ed7813-666b-495e-84c3-c33d0f1546a2';

COMMIT;