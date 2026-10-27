-- Season calendar settings.
--
-- A season now owns a calendar: which days the leagues play, and which days
-- are reserved for cups (CAF, Nedbank, international breaks). Leagues only get
-- fixtures on league days, so the league pauses completely on cup days.
--
-- Shape:
--   {
--     "preset": "full",
--     "calendar": {
--       "preset": "full",
--       "startDate": "2026-11-09",
--       "endDate": "2026-12-27",
--       "totalDays": 49,
--       "leagueRounds": 30,
--       "leagueDays": ["2026-11-09", ...],
--       "windows": [{ "key": "caf", "start": "...", "end": "...", "days": [...] }],
--       "windowsByKey": { "caf": [...], "nedbank": [...], "international": [...] }
--     }
--   }

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Existing seasons keep an empty settings object; the season calendar is only
-- written when a season is started from now on (no retrofit).
COMMENT ON COLUMN public.seasons.settings IS
  'Season-level settings. Holds the preset id and the generated season calendar (league days + cup windows).';
