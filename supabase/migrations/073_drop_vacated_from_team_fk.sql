-- ============================================================
-- 073 — Drop the vacated_from_team_id FK (PostgREST embed fix)
-- ============================================================
-- Migration 072 added tournament_participants.vacated_from_team_id with a
-- REFERENCES teams(id) FK. That left TWO FKs from tournament_participants to
-- teams (team_id + vacated_from_team_id). PostgREST cannot auto-resolve an
-- embed like `team:teams(...)` when two relationships point at the same table,
-- so every tournament_participants->teams embed (standings page, WhatsApp
-- teams list) started erroring -> the standings page collapsed to a single
-- "Group A" of 32 "Unknown team" rows.
--
-- The tracking COLUMN and the reclaim INDEX are still wanted by
-- reclaimManagerSlots (lib/slot-utils.ts); only the FK constraint is dropped.
-- The reclaim code sets vacated_from_team_id to null when a seat is refilled,
-- and only ever matches it against existing clubs, so the referential
-- integrity the FK provided was never load-bearing.

ALTER TABLE public.tournament_participants
  DROP CONSTRAINT IF EXISTS tournament_participants_vacated_from_team_id_fkey;