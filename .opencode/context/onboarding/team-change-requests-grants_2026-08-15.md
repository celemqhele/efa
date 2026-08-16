# Team Change Requests — missing service_role grants ("Request not found")

## Problem
On the Notifications page's **Pending Team Requests** list, clicking Approve or Deny
returned **"Request not found"** for all 4 pending requests, even though the requests
rendered fine and the admin (celemqhele) was authenticated.

## Root Cause
The list query (`app/(protected)/notifications/page.tsx`) uses the **user-session**
client (`authenticated` role) and works. The approve/deny route
(`app/api/admin/team-change/route.ts`) fetches the request with `createAdminClient()`
(the **`service_role`** key), and `service_role` had **no `SELECT`/`INSERT`/
`UPDATE`/`DELETE` grants** on `team_change_requests` — only `REFERENCES`/`TRIGGER`/
`TRUNCATE`. The service-role SELECT failed with "permission denied", which the route
maps to `{ error: 'Request not found' }` (404).

Same pattern as `backdoor_submissions` (fixed in migration 047).

## Fix
Migration `supabase/migrations/059_team_change_requests_grants.sql`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE team_change_requests TO service_role;
```

No app-code change needed — the route logic was already correct.

## Notes / Gotchas
- Verified all 4 pending requests existed in the DB with valid UUIDs (data was intact).
- Only `team_change_requests` was missing DML grants for `service_role`; all other
  tables the route touches (`teams`, `audit_log`, `notifications`, `profiles`) were fine.
- Minor pre-existing gap (not fixed): `messages` also lacks `DELETE` for `service_role`,
  but nothing in the codebase deletes from `messages`.
- Grant check query used: `SELECT privilege_type FROM information_schema.role_table_grants
  WHERE grantee='service_role' AND table_name='team_change_requests';`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
