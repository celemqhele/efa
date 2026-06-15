-- Update trophies trophy_type constraint to match new tournament types

ALTER TABLE public.trophies DROP CONSTRAINT IF EXISTS trophies_trophy_type_check;

UPDATE public.trophies SET trophy_type = 'tournament_club' WHERE trophy_type IN ('ucl', 'europa', 'super_cup');

ALTER TABLE public.trophies ADD CONSTRAINT trophies_trophy_type_check CHECK (trophy_type IN ('league', 'tournament_club', 'tournament_international', 'friendlies'));
