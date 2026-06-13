-- Grants for anon and authenticated roles on tables created in migrations
-- RLS policies exist but the roles need base table privileges to reach them

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_applications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_dna TO anon, authenticated;

-- Other tables that were also missing grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forfeit_balances TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_availability TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_applications TO anon, authenticated;
