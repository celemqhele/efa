-- Restore automatic Data API grants for future tables in public
-- (Supabase Oct 30, 2026 change: new tables no longer get auto-granted)
--
-- Before Oct 30 Supabase auto-granted Data API access to every new table
-- created by the postgres role in public. That default has since been
-- removed, leaving only TRUNCATE/REFERENCES/TRIGGER on future tables.
--
-- Re-create default privileges for the postgres role so ANY future table
-- created via npm run db migrations is immediately reachable through
-- supabase-js/PostgREST — no need to remember inline grants per migration.
--
-- NOTE: only affects tables created AFTER this runs; existing tables already
-- carry their grants and are untouched.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES
  TO service_role, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, UPDATE, USAGE ON SEQUENCES
  TO service_role, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS
  TO service_role, anon, authenticated;