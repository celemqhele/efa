# Migration history: 104_extra_screenshot_urls applied + tracked (2026-10-20)

Applied `supabase/migrations/104_extra_screenshot_urls.sql` to the remote
Supabase database and recorded it in `supabase_migrations.schema_migrations`.
Follows `.opencode/context/migration-history/096-submit-match-portal_2026-10-07.md`
for the migration-numbering workflow, and supports the multi-screenshot portal
work documented in
`.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md`.

## What ran

- `npm run db -- supabase/migrations/104_extra_screenshot_urls.sql` — added
  `results.extra_screenshot_urls jsonb` (`add column if not exists`, idempotent)
  plus a column comment. Verified afterwards with an
  `information_schema.columns` query: one row, `jsonb`.
- `npx tsx scripts/backfill-migration-history.ts` — 7 inserted, 104 skipped,
  total tracked = 103. Verified `supabase_migrations.schema_migrations` now has
  version `104` / name `extra_screenshot_urls` (previously latest was `103`).
- No grants were needed: it is a new column on the already-granted `results`
  table, so the AGENTS.md belt-and-braces rule (NEW tables) did not apply.

## Files

- `C:\Users\mqhel\efa\supabase\migrations\104_extra_screenshot_urls.sql`
- `C:\Users\mqhel\efa\scripts\backfill-migration-history.ts` (unchanged, run as-is)

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
