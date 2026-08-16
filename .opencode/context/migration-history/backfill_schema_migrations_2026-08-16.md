# Backfill supabase_migrations.schema_migrations (tracking table out of sync)

## Problem
`supabase_migrations.schema_migrations` — Supabase's migration-history tracking
table (`version` text PK, `statements` text[], `name` text) — only recorded
migrations `001`–`032`. Migrations `033`–`059` were applied manually via
`npm run db` (scripts/db.ts), which executes SQL but never writes to the
tracking table.

Every object those migrations create already existed in the DB (verified
against the live database: tables, columns, constraints, functions, triggers,
cron jobs, storage buckets/policies, grants — all present). So this was purely a
**bookkeeping gap**, not missing schema.

Why it mattered: a future `supabase db push` / `db reset` compares local
migration files against the tracking table and would consider `033`–`059`
unapplied and re-run them. Several are NOT idempotent (e.g. `034`'s
`ALTER TABLE ... ADD CONSTRAINT`, `037`/`045` `CREATE TRIGGER`, `041`
`CREATE POLICY`, `040`/`042` `cron.schedule`) → errors or duplicates.

## Fix
Created `scripts/backfill-migration-history.ts` (one-off, idempotent):
- Reads `supabase/migrations/*.sql`, sorts ascending.
- `version` = leading digits, `name` = filename minus `NNN_` prefix and `.sql`.
- Splits each file into SQL statements with a parser that respects
  `$$...$$`/`$tag$` dollar-quoting, `'...'` strings (`''` escapes), and
  `--` / `/* */` comments — a naive `;` split would break plpgsql bodies.
- `INSERT ... ON CONFLICT (version) DO NOTHING` for every file `001`–`059`.
- Result: 26 rows inserted (`033`–`059`, no `055`), 33 skipped (already
  tracked), total tracked = 58.

Run with: `npx tsx scripts/backfill-migration-history.ts`

## Verification
`SELECT version, name FROM supabase_migrations.schema_migrations
 ORDER BY version::int;` → 58 rows, versions `001`–`059` minus `055`.

## Notes / Gotchas
- **`055` never existed** — files jump `054` → `056`. Nothing to track.
- **Duplicate version `002`** — `002_penalty_scores.sql` and
  `002_rls_policies.sql` share version `002`; only `002`/`rls_policies` is
  tracked. `002_penalty_scores` was skipped by the backfill (PK conflict), but
  its columns (`results.pen_home_score` / `pen_away_score`) exist in the DB, so
  nothing is lost. If the CLI ever needs to know, that migration stays
  untracked by design.
- One deleted one-off script in history: `scripts/backfill-postponed-matchdays.sql`
  (removed in `84190d0`) — not a migration, irrelevant to tracking.
- The script is kept in `scripts/` alongside other one-off DB tools; it is
  safe to re-run any time (idempotent).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
