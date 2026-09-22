-- Poll voter restrictions: allowlist of eligible voter user_ids with per-user league folders
-- voter_restrictions JSONB maps user_id -> [league_folder, ...]
--   - null/absent: poll is open to any authenticated user (legacy behavior)
--   - present: only users in the map can apply, and only to teams in their allowed folders

ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS voter_restrictions jsonb;

CREATE INDEX IF NOT EXISTS polls_voter_restrictions_idx ON public.polls USING gin (voter_restrictions);