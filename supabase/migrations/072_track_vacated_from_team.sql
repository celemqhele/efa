-- ============================================================
-- 072 — Track which club a vacated slot belonged to
-- ============================================================
-- When a seat is vacated (sack / auto-sack), the slot's team_id is
-- swapped to the shared "Vacant" placeholder so ownerless seats render
-- as Vacant. That rewrite loses the identity of the club the slot used
-- to represent, so a later manager assignment for that club cannot find
-- its seat again — the club "splits" into a Vacant seat (no stats) plus
-- phantom rows from its already-played fixtures.
--
-- This column records the club a vacated seat belonged to. The reclaim
-- logic (lib/slot-utils.ts -> reclaimManagerSlots) then finds, and
-- refills, the club's own seat on manager assignment — even for clubs
-- with no played fixtures (where no fixture still references the club).

-- ─────────────────────────────────────────────────────────────
-- 1) Column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS vacated_from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 2) Index for reclaim lookups (active tournament + club)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tournament_participants_vacated_from_team_idx
  ON public.tournament_participants (tournament_id, vacated_from_team_id)
  WHERE vacated_from_team_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3) Backfill: seats currently showing a real club but ownerless are
--    "implicitly vacated from" that club — reclaim treats them as the
--    club's seat via the team_id match anyway, so no backfill needed.
--    (Kept empty on purpose; historical broken seats are repaired by
--    the one-off repair in scripts/cup-slot-repair.ts.)
-- ─────────────────────────────────────────────────────────────
SELECT 1;