-- Add form column to group_standings
ALTER TABLE group_standings ADD COLUMN IF NOT EXISTS form text DEFAULT '';
