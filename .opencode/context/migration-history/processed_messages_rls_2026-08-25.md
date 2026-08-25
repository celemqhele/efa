# processed_messages RLS Fix

## What happened
Supabase dashboard flagged `public.processed_messages` as having RLS disabled. The table (created in migration `042`) was the only table in the project without RLS enabled.

## What was done
- Created migration `060_processed_messages_rls.sql`
- Enabled RLS with minimal policies:
  - `Authenticated can insert processed messages` (INSERT)
  - `Authenticated can delete processed messages` (DELETE)
- No SELECT policy — no application code reads this table
- `service_role` bypasses RLS, so webhook inserts (`app/api/webhook/route.ts`) and pg_cron cleanup are unaffected

## Why it's safe
- The webhook uses `createAdminClient()` (service_role key), which bypasses RLS
- The pg_cron cleanup runs as superuser, also unaffected by RLS
- Existing GRANTs from migration `048` remain valid alongside RLS

## Related migrations
- `042_processed_messages.sql` — table creation, index, cleanup function, cron job
- `048_processed_messages_grants.sql` — GRANT SELECT/INSERT/UPDATE/DELETE to service_role, anon, authenticated

## Restore File Section
- Original path: `supabase/migrations/060_processed_messages_rls.sql`
- Purpose: Enable RLS on processed_messages table
- New path: N/A (file was created, not moved)
