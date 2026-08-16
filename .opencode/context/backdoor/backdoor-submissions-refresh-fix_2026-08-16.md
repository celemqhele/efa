# Backdoor Submissions Status Not Updating After Approve/Decline

## Problem
On `/admin/backdoor-submissions`, after clicking Approve or Decline on a backdoor
submission, the UI kept showing the old status (e.g. still "⏳ Pending") until the
page was manually refreshed. The DB write succeeded but the UI never re-fetched.

## Root Cause
`app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx` wrote the
status change directly via the Supabase client but only bumped a `refreshKey` state
counter that was never consumed anywhere. The page's data comes from the server
component `page.tsx` (passed down through `_shell.tsx`), so the client bump had no
effect — no server re-fetch, no prop update.

## Fix
Replaced the dead `refreshKey` state with the codebase-standard `router.refresh()`
(`useRouter` from `next/navigation`):

- `const router = useRouter()` in the client component; removed `refreshKey` state.
- `handleAction`: `setRefreshKey(k => k + 1)` → `router.refresh()` after the DB
  writes / notify, so `page.tsx` re-runs and re-fetches submissions.
- Refresh button: `onClick={() => setRefreshKey(k => k + 1)}` → `onClick={() => router.refresh()}`.

After an action, the server component re-renders, so status badges, review
timestamps, and the Approve/Decline buttons all update immediately.

## Notes / Gotchas
- This matches the pattern already used across admin pages (`AdminNotificationsClient`,
  `SeasonManager`, `TeamRequestButtons`, etc.).
- Pre-existing lint warnings (unused imports/`isPending`/`hasScreenshot`) remain;
  `npx tsc --noEmit` passes. No API/schema changes.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
