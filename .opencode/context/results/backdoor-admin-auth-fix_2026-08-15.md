# Backdoor Admin Review — "Not authenticated" fix

## Problem
On `/admin/backdoor-submissions`, clicking Approve/Decline threw **"Not authenticated"**
even while logged in as admin (`celemqhele`). The page rendered fine, but every
decision action failed.

## Root Cause
`BackdoorSubmissionsClient.tsx` created its supabase client with the raw
`createClient` from `@supabase/supabase-js`, which stores the auth session in
**localStorage**. This app authenticates via **cookies** (`@supabase/ssr` through
`middleware.ts` and `lib/supabase/client.ts`). So `supabase.auth.getUser()` in the
browser returned `null` (no localStorage session), and the code threw
`Not authenticated` before doing any work.

Every other admin client (e.g. `admin/polls/page.tsx`, `admin/notifications/
AdminNotificationsClient.tsx`) already used the shared cookie-based client — this
page was the one outlier.

## Fix (`app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx`)
- Import: `@supabase/supabase-js` → `@/lib/supabase/client`
- Client: inline `createClient(url, anonKey)` → `const supabase = createClient()`
  (cookie-aware `createBrowserClient`).

`supabase.auth.getUser()` now resolves to the logged-in admin, so approve/decline
write `reviewed_by = <admin id>`, and the existing notify/recalculate flow fires.

## Notes / Gotchas
- RLS was NOT a blocker: `fixtures_admin_all`, `rc_admin_all`, `results_admin_all`
  (`002_rls_policies.sql`, `is_admin()`) already permit admin writes once
  authenticated.
- Server `page.tsx` unchanged — it uses the service-role key for the read-only
  query, which is fine.
- `next tsc --noEmit` passes; `next lint` reports only pre-existing unused-var
  warnings in this file.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
