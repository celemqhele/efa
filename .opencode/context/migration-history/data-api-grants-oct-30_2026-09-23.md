# Data API grants convention added for Supabase Oct 30, 2026 change

Added a rule to `AGENTS.md` requiring every migration that creates a table to
include its Data API `GRANT` statements in the same file, because Supabase
stops auto-granting `public` schema access to new tables on Oct 30, 2026.

## Problem
Supabase emailed that on Oct 30, 2026 it will stop automatically granting Data
API access (anon/authenticated/service_role) to **new** tables in `public` for
existing projects. Existing tables keep their current grants — no action needed
for those. New tables created without explicit grants become unreachable via
supabase-js/PostgREST (permission denied), and the requirement applies to
migrations, preview branches, and `supabase db reset` too.

Audited the live DB (45 public tables): every existing table already carries its
grants, so the app (client calls + admin/backdoor features) is safe today. The
risk is only forward-facing: a future migration that creates a table without
inline grants would ship an unreachable table.

## Fix
Added a "Data API grants — required on every new table (Oct 30, 2026 rule)"
section to `AGENTS.md` right after the Supabase usage block:
- Mandates `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO
  service_role, anon, authenticated;` (minimal role list) in the **same**
  migration that creates the table.
- Points at `supabase/migrations/053_backdoor_window.sql` and
  `supabase/migrations/066_user_based_slots.sql` as the existing inline-grant
  pattern to follow.

No schema change was made to the live database — this was a docs/convention
change only.

## Related files
- `AGENTS.md` (the convention section added)
- `supabase/migrations/053_backdoor_window.sql` (inline grants pattern)
- `supabase/migrations/066_user_based_slots.sql` (inline grants pattern)
- Earlier migration bookkeeping chain: `.opencode/context/migration-history/backfill_schema_migrations_2026-08-16.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |