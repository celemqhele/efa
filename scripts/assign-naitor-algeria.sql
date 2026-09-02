-- Assign NAITOR (e36f49c5-f16d-43d0-823d-e318fa8e8f99) to Algeria (3241dc70-7674-4662-9cbc-b3f0471e93d4)
BEGIN;

-- Close any open tenures for Algeria (none expected, safe no-op)
UPDATE manager_tenures
SET ended_at = now()
WHERE team_id = '3241dc70-7674-4662-9cbc-b3f0471e93d4'
  AND ended_at IS NULL;

-- Assign manager on the Algeria team row
UPDATE teams
SET manager_id = 'e36f49c5-f16d-43d0-823d-e318fa8e8f99'
WHERE id = '3241dc70-7674-4662-9cbc-b3f0471e93d4';

-- Open a new tenure
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at)
VALUES (
  '3241dc70-7674-4662-9cbc-b3f0471e93d4',
  'e36f49c5-f16d-43d0-823d-e318fa8e8f99',
  'NAITOR',
  now()
);

COMMIT;
