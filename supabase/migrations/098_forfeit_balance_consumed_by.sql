-- Track which fixture consumed a forfeit balance, so re-submitting that same
-- match (changing the score) can RE-OPEN and re-apply the balance instead of
-- silently dropping it (remaining had been set to 0 on the first submission).

ALTER TABLE public.forfeit_balances
  ADD COLUMN IF NOT EXISTS consumed_by_fixture_id UUID;

-- Backfill: a balance is cited in the override_reason of the result that
-- consumed it, as `forfeit_note:<balance.fixture_id>:<sentence>`. Point the
-- balance's consumed_by_fixture_id at that consuming result's fixture.
UPDATE public.forfeit_balances fb
SET consumed_by_fixture_id = r.fixture_id
FROM public.results r
WHERE fb.remaining = 0
  AND fb.consumed_by_fixture_id IS NULL
  AND r.override_reason LIKE '%forfeit_note:' || fb.fixture_id::text || ':%';

-- Belt-and-braces grants: column additions inherit table grants, but keep the
-- explicit grant here in case this runs on a fresh database.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.forfeit_balances TO service_role, authenticated, anon;
