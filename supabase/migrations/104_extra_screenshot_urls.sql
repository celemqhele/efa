-- Migration 104: results.extra_screenshot_urls
--
-- The submit-match portal now accepts up to four proof screenshots per result
-- (1 required + up to 3 optional, for managers who had to replay the game
-- because of network drops / disconnections). `screenshot_url` keeps the main
-- one exactly as before; the optional extras are stored here as a JSON array
-- of signed URLs so the proof archive and the results page can show them too.
--
-- Column on an existing, already-granted table (results), so no new grants are
-- needed — the belt-and-braces grant rule in AGENTS.md applies to NEW tables.

alter table public.results add column if not exists extra_screenshot_urls jsonb;

comment on column public.results.extra_screenshot_urls is
  'Optional additional proof screenshots (replayed games), JSON array of storage URLs. Main proof stays in screenshot_url.';
