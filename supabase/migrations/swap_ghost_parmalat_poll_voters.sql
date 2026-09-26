-- Swap ghost (Egypt) out of the Premiership top 16 and parmalat_ (England, the
-- highest-ranked bottom-16 manager by points then GD) into it, on the
-- "2026 SA Club Selection" poll voter_restrictions map.
-- Each folder list is a single-folder array, so we replace the value wholesale.

UPDATE polls
SET voter_restrictions = jsonb_set(
  jsonb_set(
    voter_restrictions,
    '{4a825dbb-5393-4b04-8531-eada461c3b92}',  -- ghost (Egypt)
    '["motsepe-foundation-championship-2026-2027.football-logos.cc","abc-motsepe-league-2026-2027.football-logos.cc"]'::jsonb
  ),
  '{30269b88-9c4d-4779-8f24-1212adc585ef}',  -- parmalat_ (England)
  '["south-african-premiership-2026-2027.football-logos.cc"]'::jsonb
)
WHERE share_code = 'f79b9129';