-- Null out old secondary/tertiary/combination columns.
-- Only primary_* columns are used going forward with combined descriptions.

UPDATE team_dna SET
  secondary_profile    = NULL,
  secondary_level      = NULL,
  secondary_score      = NULL,
  secondary_about      = NULL,
  secondary_tendencies = '[]'::jsonb,
  secondary_coach_note = NULL,
  secondary_weaknesses = '[]'::jsonb,
  tertiary_profile     = NULL,
  tertiary_level       = NULL,
  tertiary_score       = NULL,
  tertiary_about       = NULL,
  tertiary_tendencies  = '[]'::jsonb,
  tertiary_coach_note  = NULL,
  tertiary_weaknesses  = '[]'::jsonb,
  combination_about    = NULL,
  combination_tendencies = '[]'::jsonb,
  combination_coach_note = NULL,
  combination_weaknesses = '[]'::jsonb,
  -- Coach notes moved to fixture_coach_notes table
  primary_coach_note   = NULL;
