-- apply-vacant-takeover-canada.sql
-- Mirror assignVacantSeatToManager for the Group F vacant seat: fill it with
-- Canada (jigsaw_rsa's club), inherit the seat's stats, restamp pending
-- fixtures, and clear the seat's auto-forfeit results. Also undo the stray
-- manager binding on the Vacant placeholder team from the earlier assign.
BEGIN;

-- 1. Undo stray manager binding on the Vacant placeholder + its tenures
UPDATE teams
SET manager_id = NULL
WHERE id = '820ea628-d202-473d-8d75-62cac670f135'
  AND logo_league_folder = 'custom' AND logo_team_slug = 'vacant';

UPDATE manager_tenures
SET ended_at = now()
WHERE team_id = '820ea628-d202-473d-8d75-62cac670f135'
  AND ended_at IS NULL;

-- 2. Fill the vacant seat with Canada (user stays jigsaw_rsa)
UPDATE tournament_participants
SET user_id = 'a83cecc6-5cb7-4238-8d8c-2362e9e0590d',
    team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e',
    vacated_from_team_id = NULL
WHERE id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc';

-- 3. Restamp pending fixtures home/away team_id -> Canada
UPDATE fixtures
SET home_team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND home_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc'
  AND status IN ('scheduled','awaiting_confirmation','confirmed_pending');

UPDATE fixtures
SET away_team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND away_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc'
  AND status IN ('scheduled','awaiting_confirmation','confirmed_pending');

-- 4. Restamp standings
UPDATE group_standings
SET team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc';

UPDATE standings
SET team_id = '2c4a51fa-4b64-4765-95db-5ac102b7146e'
WHERE tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc';

-- 5. Capture confirmed_pending fixtures carrying auto-forfeit results so they
--    can be reset to scheduled after the results are removed.
CREATE TEMP TABLE _vacant_auto_fx AS
SELECT f.id
FROM fixtures f
JOIN results r ON r.fixture_id = f.id
WHERE (f.home_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc'
    OR f.away_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc')
  AND f.tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
  AND f.status = 'confirmed_pending'
  AND r.finalised_by IS NULL
  AND (r.override_reason LIKE 'Vacant slot absent%'
    OR r.override_reason LIKE 'Both slots vacant%');

-- Delete the auto-forfeit results on this seat's unplayed fixtures
DELETE FROM results
WHERE fixture_id IN (
  SELECT f.id
  FROM fixtures f
  WHERE (f.home_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc'
      OR f.away_participant_id = '5bbfef70-eb55-4a8e-93cc-097784a7cccc')
    AND f.tournament_id = 'e2c61a3e-072e-4a07-8024-76de20c2a99a'
    AND f.status IN ('scheduled','awaiting_confirmation','confirmed_pending')
)
AND finalised_by IS NULL
AND (
  override_reason LIKE 'Vacant slot absent%'
  OR override_reason LIKE 'Both slots vacant%'
);

-- Return any confirmed_pending fixture of this seat back to scheduled
UPDATE fixtures
SET status = 'scheduled'
WHERE id IN (SELECT id FROM _vacant_auto_fx)
  AND status = 'confirmed_pending';

DROP TABLE _vacant_auto_fx;

COMMIT;
