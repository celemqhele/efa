-- Add 'r16' (Round of 16) to fixture round_type check constraint
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

  EXECUTE 'ALTER TABLE fixtures ADD CONSTRAINT fixtures_round_type_check CHECK (round_type IN (''league'', ''group'', ''r16'', ''qf'', ''sf'', ''final'', ''super_cup''))';
END $$;
