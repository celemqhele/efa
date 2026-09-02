-- Two-division seasons: tag league tournaments with their division number
-- (1 = EFA Premier League, 2 = EFA Championship; NULL = legacy single league).
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS division integer;

-- Existing league tournaments belong to the old single division.
UPDATE public.tournaments
SET division = 1
WHERE type = 'league' AND division IS NULL;

CREATE INDEX IF NOT EXISTS tournaments_season_type_division_idx
  ON public.tournaments (season_id, type, division);