# Migration history: 096_submit_match_portal applied + backfilled (2026-10-07)

Applied `supabase/migrations/096_submit_match_portal.sql` to the remote Supabase database and
recorded it in `schema_migrations` via the backfill script.

## What ran

- `npm run db -- supabase/migrations/096_submit_match_portal.sql` — created:
  - `fixtures.postponed_confirmed boolean not null default false` (verified present)
  - `postpone_requests` table (verified present, 1 table)
  - `match-screenshots` storage bucket (verified present; proper bucket + policies were created in
    the same migration, with the `belt-and-braces` grants pattern from
    `.opencode/context/migration-history/data-api-default-privileges_2026-09-23.md`)
- `npx tsx scripts/backfill-migration-history.ts` — 36 rows inserted, 67 already tracked, total
  tracked migrations = 95.

## Files

- `C:\Users\mqhel\efa\supabase\migrations\096_submit_match_portal.sql`
- `C:\Users\mqhel\efa\scripts\backfill-migration-history.ts` (unchanged, run as-is)