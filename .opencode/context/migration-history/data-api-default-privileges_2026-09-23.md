# Data API default privileges restored for future tables (Supabase Oct 30, 2026)

Created migration `076_data_api_default_privileges.sql` that restores Supabase's
pre-Oct-30 auto-grant as **default privileges** for the `postgres` role in
`public`, so every future table created via `npm run db` is Data-API-reachable
without needing per-migration grants.

## Problem
The user pointed out that the AGENTS.md convention from
`.opencode/context/migration-history/data-api-grants-oct-30_2026-09-23.md`
(remember to add inline grants) was only a reminder, not a guarantee — new
tables WILL keep being created, and forgetting grants would ship unreachable
tables after Supabase stops auto-granting Data API access on Oct 30, 2026.

Live DB inspection (`pg_default_acl`) confirmed the danger: the default ACL for
the `postgres` role in `public` granted anon/authenticated/service_role only
`Dxtm` (TRUNCATE/REFERENCES/TRIGGER) on new tables — no SELECT/INSERT/UPDATE/
DELETE. Full grants existed only under `supabase_admin` defaults, which the
migration path (`npm run db` as `postgres`) never uses.

## Fix
- New migration `supabase/migrations/076_data_api_default_privileges.sql`
  (run and verified against the live DB):
  - Tables: `GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
    TRIGGER ON TABLES TO service_role, anon, authenticated` for `postgres`
    defaults in `public`.
  - Sequences: `GRANT SELECT, UPDATE, USAGE ON SEQUENCES` (same roles).
  - Functions: `GRANT EXECUTE ON FUNCTIONS` (same roles).
- Verified with a throwaway table `public.__grant_test` (created, checked
  `information_schema.role_table_grants`, dropped): anon/authenticated/
  service_role each received the full grant set automatically.
- Existing tables untouched (they already keep their grants; the Oct 30 rule
  does not revoke anything).
- Updated the AGENTS.md section (added in the prior context file) to reflect
  that default privileges are now the primary safety net and inline grants are
  belt-and-braces.

## Gotchas / Notes
- Default privileges are additive and idempotent — safe to re-run on fresh or
  preview databases, but they do NOT roll back.
- They only apply to objects created AFTER the ALTER runs and only for the
  `postgres` role — matching how `scripts/db.ts` executes migrations.
- Dashboard/CLI-created tables (as `supabase_admin`) retain their own separate
  defaults and are not covered by this migration, but this repo deploys via
  `npm run db`.

## Related files
- `supabase/migrations/076_data_api_default_privileges.sql`
- `AGENTS.md` (updated "Data API grants" section)
- Prior chain: `.opencode/context/migration-history/data-api-grants-oct-30_2026-09-23.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |