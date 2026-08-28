-- Clean up "National Team" suffix from national team names, e.g.
-- 'Cote D Ivoire National Team' -> 'Cote D Ivoire'.
-- Alias rows reference teams by team_id, so they are unaffected by the rename.

UPDATE public.teams SET name = 'Austria'       WHERE name = 'Austria National Team';
UPDATE public.teams SET name = 'Cabo Verde'    WHERE name = 'Cabo Verde National Team';
UPDATE public.teams SET name = 'Canada'        WHERE name = 'Canada National Team';
UPDATE public.teams SET name = 'Colombia'      WHERE name = 'Colombia National Team';
UPDATE public.teams SET name = 'Cote D Ivoire' WHERE name = 'Cote D Ivoire National Team';
UPDATE public.teams SET name = 'Panama'        WHERE name = 'Panama National Team';
UPDATE public.teams SET name = 'Senegal'       WHERE name = 'Senegal National Team';
UPDATE public.teams SET name = 'Sweden'        WHERE name = 'Sweden National Team';
UPDATE public.teams SET name = 'Tunisia'       WHERE name = 'Tunisia National Team';
UPDATE public.teams SET name = 'USA'           WHERE name = 'Usa National Team';