-- Add personalized description columns to team_dna
-- These store curated, team-specific playstyle analysis written by the AI assistant
-- based on each team's actual match stats (last 10 fixtures).
-- Templates in lib/dna-explanations.ts are no longer used.

ALTER TABLE team_dna
  ADD COLUMN IF NOT EXISTS primary_about text,
  ADD COLUMN IF NOT EXISTS primary_tendencies jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_coach_note text,
  ADD COLUMN IF NOT EXISTS primary_weaknesses jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_about text,
  ADD COLUMN IF NOT EXISTS secondary_tendencies jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_coach_note text,
  ADD COLUMN IF NOT EXISTS secondary_weaknesses jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tertiary_about text,
  ADD COLUMN IF NOT EXISTS tertiary_tendencies jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tertiary_coach_note text,
  ADD COLUMN IF NOT EXISTS tertiary_weaknesses jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS combination_about text,
  ADD COLUMN IF NOT EXISTS combination_tendencies jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS combination_coach_note text,
  ADD COLUMN IF NOT EXISTS combination_weaknesses jsonb default '[]'::jsonb;
