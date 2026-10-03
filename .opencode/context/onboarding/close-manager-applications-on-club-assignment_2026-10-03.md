# Manager applications leave the pending list once a club is assigned

Assigned `suab` a club through the admin manager-management flow and his application kept showing under pending applications as "(no team yet)", even though he was already the manager of Venda FC. The application now clears from the list as soon as the applicant is given a team, whichever route gave them it.

## Problem
There are two independent admin paths that bind a manager to a club, and only one of them knew about `manager_applications`:

1. **`manager applications` flow** — `app/api/webhook/route.ts` → `applyManagerAssignment()`. This one already approved the application and denied the applicant's other pending applications.
2. **Manager-management flow / web admin** — `lib/manager-mgmt.ts` → `assignManagerToClub()`. This one set `teams.manager_id`, opened tenures, reclaimed seats and wrote the `assign_manager` audit row, but never touched `manager_applications`. `promoteManagerToClub()` and `replaceManagerOnClub()` both funnel through it, so they inherited the same gap.

`suab` was assigned Venda FC at 15:43 via path 2 (audit row `assign_manager`, not `approve_manager_application`), leaving application `62b0313d-d6d7-46a1-b30b-0f18bf34958e` pending with `team_id = null`. Both the WhatsApp list and `app/(admin)/admin/users/manage/page.tsx` filter on `status = 'pending'`, so it read as an unhandled applicant. `khwezii_10` (manages Hope) had the same stale row from 2026-10-02.

## Fix
- **`lib/manager-mgmt.ts`** — new exported `closePendingManagerApplications(db, { userId, teamId, adminId })`. It approves the applicant's oldest pending application (preferring a team-less one, since that is the application this club finally answers) stamped with the club, denies their remaining pending applications, and denies anyone else waiting on that club. Mirrors the bookkeeping `applyManagerAssignment()` already did by hand.
- Called from `assignManagerToClub()` right after the `assign_manager` audit insert, so it covers all three assignment paths plus both entry points. Placed before the Vacant branch, so the Vacant/takeover path gets it too.
- The whole helper body is wrapped in try/catch with a `console.error`: applications are bookkeeping, so a failure there must never fail the assignment itself.
- **`app/api/webhook/route.ts`** — `handleManagerApplicationsStart()` now drops pending applications whose applicant already holds a club. The data fix below handles existing rows, but this keeps any row that predates the fix (or arrives via a path that misses the helper) out of the admin's list.
- **`supabase/migrations/093_close_applications_for_assigned_managers.sql`** — data fix for rows that predate the code fix. Materialises the per-applicant ranking into a temp table first, because a data-modifying CTE that is never referenced does not execute, and because recomputing the ranking after the winner is approved would promote a different row to first place.

## Verified
- `npx tsc --noEmit` and `npm run lint` pass (lint warnings pre-existing, none in the touched files).
- Migration applied to live Supabase. `suab` → approved / Venda FC, `khwezii_10` → approved / Hope.
- `SELECT count(*) FROM manager_applications ma JOIN teams t ON t.manager_id = ma.applicant_id WHERE ma.status='pending'` returns 0.

## Key files
- `lib/manager-mgmt.ts`: `closePendingManagerApplications()` + the call in `assignManagerToClub()`.
- `app/api/webhook/route.ts`: `handleManagerApplicationsStart()` display filter.
- `supabase/migrations/093_close_applications_for_assigned_managers.sql`: stale-row cleanup.

## Related files
- The original applications flow these rules mirror: `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`.
- `assignManagerToClub()` is the service shared by the WhatsApp manager-management flow and the web admin routes: `.opencode/context/whatsapp-manager-mgmt/whatsapp-admin-manager-mgmt_2026-10-02.md`.
- The web admin page that also renders pending applications (its team-less Approve button is disabled, but the row still listed): `.opencode/context/user-management/assign-team-modal-alignment_2026-09-07.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
