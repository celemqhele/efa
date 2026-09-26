-- Add every existing profile that is not yet in the "2026 SA Club Selection" poll
-- voter_restrictions map, granting them Motsepe Foundation Championship + ABC
-- Motsepe League folders only. Existing entries (incl. the top-16 Premiership
-- managers and bottom-16 Motsepe managers) are preserved unchanged.

UPDATE polls
SET voter_restrictions = sub.vr
FROM (
  SELECT jsonb_object_agg(p.id::text, COALESCE(ex.v, '["motsepe-foundation-championship-2026-2027.football-logos.cc","abc-motsepe-league-2026-2027.football-logos.cc"]'::jsonb)) AS vr
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT x.value AS v
    FROM jsonb_each((SELECT voter_restrictions FROM polls WHERE share_code = 'f79b9129')) x
    WHERE x.key = p.id::text
  ) ex ON true
) sub
WHERE share_code = 'f79b9129';