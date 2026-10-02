-- 087: restore Data API DML grants for service_role on legacy tables
--
-- Migration 076 restored default privileges for FUTURE tables, but 15 tables
-- that predate it were left without Data API grants after the Supabase
-- Oct 30, 2026 change. service_role currently holds only TRUNCATE/REFERENCES/
-- TRIGGER on them, so every PostgREST call from the admin client
-- (createAdminClient() -> SUPABASE_SERVICE_ROLE_KEY) fails with
-- "permission denied for table <name>".
--
-- This is a SILENT failure path in tournament-progression.ts: awardTrophy()
-- inserts into `trophies` without checking the error, so a completed final
-- marks the tournament completed but records no winner. The most recent trophy
-- row is dated 2026-09-25, i.e. nothing has been awarded since the grant
-- change.
--
-- Same list the audit query surfaced:
--   SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--     AND NOT (has_table_privilege('service_role', c.oid, 'SELECT') AND ...)
--
-- service_role only: these are server-side tables (chat, pins, aliases, search
-- profiles). Client-side roles already have whatever they need on the tables
-- they touch, so their grants are intentionally left untouched here.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.channel_messages,
  public.channels,
  public.comments,
  public.conversations,
  public.knockout_rounds,
  public.manager_pins,
  public.messages,
  public.predictions,
  public.reactions,
  public.search_profiles,
  public.season_breaks,
  public.team_aliases,
  public.team_name_mappings,
  public.trophies,
  public.waiting_reports
TO service_role;