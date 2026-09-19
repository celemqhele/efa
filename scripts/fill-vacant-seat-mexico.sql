-- ============================================================
-- One-off repair: fill the vacated (ex-Croatia) seat in the active
-- EFA International Cup with Mexico, owned by khumoshxta.
-- Run via:  npm run db -- scripts/fill-vacant-seat-mexico.sql
-- ============================================================
-- Context: Croatia was disqualified (vacateUserSlots) -> seat
-- 2c101774 became ownerless with team_id -> Vacant placeholder.
-- The admin then "filled" it twice on the Vacant team page but the
-- chosen profile (khumoshxta_) manages no club, so the claim path
-- was a no-op and the seat stayed Vacant. Intent: the seat should
-- show Mexico (manager khumoshxta). Played fixtures (Croatia's 3
-- confirmed games + the human-entered MD52 backdoor forfeit, all
-- with finalised_by set) stay as history. The two pending auto-
-- forfeits (MD88/MD93, finalised_by NULL) are removed so Mexico
-- actually plays those fixtures.

BEGIN;

-- ─── Seat: owner khumoshxta, club Mexico ───
UPDATE public.tournament_participants
SET user_id = '5c91fd0a-6577-48de-b092-f41110b97f29',  -- khumoshxta
    team_id = '296d42ad-d549-406a-8412-4e3eca82084b',  -- Mexico
    vacated_from_team_id = NULL
WHERE id = '2c101774-0983-4efd-89dc-502f58136250';

-- ─── Display references follow the slot's club ───
UPDATE public.group_standings
SET team_id = '296d42ad-d549-406a-8412-4e3eca82084b'   -- Mexico
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND participant_id = '2c101774-0983-4efd-89dc-502f58136250';

UPDATE public.standings
SET team_id = '296d42ad-d549-406a-8412-4e3eca82084b'   -- Mexico
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND participant_id = '2c101774-0983-4efd-89dc-502f58136250';

-- Pending fixtures only: played fixtures keep the club that actually played.
UPDATE public.fixtures
SET home_team_id = '296d42ad-d549-406a-8412-4e3eca82084b'   -- Mexico
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND home_participant_id = '2c101774-0983-4efd-89dc-502f58136250'
  AND status IN ('scheduled', 'awaiting_confirmation', 'confirmed_pending');

UPDATE public.fixtures
SET away_team_id = '296d42ad-d549-406a-8412-4e3eca82084b'   -- Mexico
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND away_participant_id = '2c101774-0983-4efd-89dc-502f58136250'
  AND status IN ('scheduled', 'awaiting_confirmation', 'confirmed_pending');

-- ─── Remove the seat's unused auto-forfeits (finalised_by NULL) ───
DELETE FROM public.results r
USING public.fixtures f
WHERE r.fixture_id = f.id
  AND f.tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND (f.home_participant_id = '2c101774-0983-4efd-89dc-502f58136250'
       OR f.away_participant_id = '2c101774-0983-4efd-89dc-502f58136250')
  AND r.finalised_by IS NULL
  AND (r.override_reason LIKE 'Vacant slot absent%'
       OR r.override_reason LIKE 'Both slots vacant%');

-- Return any confirmed_pending fixture on this seat (that just lost its
-- auto-forfeit) back to scheduled so it is a normal fixture again.
UPDATE public.fixtures
SET status = 'scheduled'
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND (home_participant_id = '2c101774-0983-4efd-89dc-502f58136250'
       OR away_participant_id = '2c101774-0983-4efd-89dc-502f58136250')
  AND status = 'confirmed_pending'
  AND NOT EXISTS (SELECT 1 FROM public.results r WHERE r.fixture_id = public.fixtures.id);

COMMIT;