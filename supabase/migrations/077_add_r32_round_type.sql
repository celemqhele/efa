-- Add 'r32' (Round of 32 / last 32) to fixture round_type check constraint.
-- Required for straight 32-team single-leg knockouts (Nedbank Cup in Season 4),
-- since generateTBCKnockouts previously supported only 2/4/8/16 qualifiers.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'fixtures'::regclass
    AND pg_get_constraintdef(oid) LIKE '%round_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE fixtures DROP CONSTRAINT ' || constraint_name;
  END IF;

  EXECUTE 'ALTER TABLE fixtures ADD CONSTRAINT fixtures_round_type_check CHECK (round_type IN (''league'', ''group'', ''r32'', ''r16'', ''qf'', ''sf'', ''final'', ''super_cup''))';
END $$;
