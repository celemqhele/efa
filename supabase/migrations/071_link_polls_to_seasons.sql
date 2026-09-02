-- Link polls to seasons and track poll source on tournament applications

-- Add season_id to polls (nullable for legacy polls)
ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id);

-- Index for finding polls by season
CREATE INDEX IF NOT EXISTS polls_season_id_idx ON public.polls (season_id);

-- Track poll source on tournament applications
ALTER TABLE public.tournament_applications
ADD COLUMN IF NOT EXISTS poll_id uuid REFERENCES public.polls(id);

-- Index for finding applications by poll
CREATE INDEX IF NOT EXISTS tournament_applications_poll_idx ON public.tournament_applications (poll_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.polls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tournament_applications TO authenticated;