-- Redesign tournament types: league / tournament_club / tournament_international / friendlies

-- Drop old check constraint
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_type_check;

-- Migrate existing rows
UPDATE public.tournaments SET type = 'tournament_club' WHERE type IN ('ucl', 'europa', 'super_cup');

-- Add new check constraint
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_type_check CHECK (type IN ('league', 'tournament_club', 'tournament_international', 'friendlies'));
