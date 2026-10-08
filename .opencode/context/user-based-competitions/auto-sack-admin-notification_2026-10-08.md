# Auto-sack now notifies admins (in-app bell + browser push)

Added an admin-facing notification to `checkAndAutoSack()` so that when the system removes a manager automatically after four straight absences, every admin gets the popup/push instead of discovering the empty club page by hand. The user reported: "when system automatically sacks player due to too many backdoor losses I am not notified, I only find out when I check the team's page."

## Problem

`checkAndAutoSack()` (`app/api/admin/finalise-result/route.ts`) already did four things when the threshold was met: cleared `manager_id` on every sibling row, stamped `profiles.sacked_at`, ran `forfeitUnmanagedClubSlots()`, closed open `manager_tenures`, notified **the sacked manager** (`insertNotificationsAndPush`, type `manager_sacked`) and wrote an `auto_sack_manager` row to `audit_log`.

Nothing reached an admin. Confirmed against the DB: all 8 historical `auto_sack_manager` audit rows have **zero** matching admin notification rows — the only `manager_sacked` notifications ever written went to the sacked user (e.g. the 2026-08-24 AC Milan auto-sack). The admin-facing alerting that exists for comparable events (`notifyAllAdmins` for backdoor submissions / postponements, `sendAdminPush` for backdoor approvals) was never wired into the auto-sack.

Note the trigger criteria: the loss must be a `results.override_reason` containing `absent` (admin-marked absence on `/admin/results/submit`, `"Both teams absent…"`, or `"Managerless club absent…"`), plus the score pattern 0-3/3-0. Results written by the backdoor approve route / webhook approve / `auto-finalise-prev-day` cron do **not** set an `absent` reason, so those alone never satisfy the check.

## Fix

In `checkAndAutoSack()`, after the existing `audit_log` insert (so an alerting failure can never block the audit trail):

- Fetch the sacked manager's `profiles.username` (for a readable body, fallback `"A manager"`).
- `notifyAllAdmins(db, { … })` from `lib/notify.ts` — inserts one `notifications` row per admin **and** web-pushes each of them (that helper wraps `insertNotificationsAndPush`), so a single call covers both channels the user chose:
  - `type: 'manager_sacked'` — icon `Ban` / red already mapped in `components/ui/GlobalNotifications.tsx` and `app/(protected)/notifications/_desktop.tsx` + `_mobile.tsx`, so no UI change was needed.
  - `title: 'Manager Auto-Sacked'`, body `"<username> was removed as manager of <team> after 4 consecutive absences."`
  - `data.team_id` set (the popup's `handleItemClick` falls through to `/teams/{team_id}`) plus an explicit `push_url: '/teams/{teamId}'` for the push payload.
- Whole call wrapped in `try/catch` + `console.error` — non-fatal, matching the surrounding absence-tracking block's style.

The sacked manager's own notification, the audit row and the sack itself are untouched.

## Verification

- `npx tsc --noEmit` clean.
- `npx eslint app/api/admin/finalise-result/route.ts` — only the 2 pre-existing warnings (`awardTrophy`, `MatchStatsInsert`), none from the new code.
- `npm run build` — compile/types/page generation all green; first run hit the known flaky Windows `.next/export/500.html` rename error, immediate re-run completed clean.
- Data check: a query replicating the 4-straight-absence rule across all managed clubs currently returns **no** rows, so nothing was in a pending-to-fire state at deploy time.

## Known limits

- Admins are notified only from this one path. The manual sack routes (`/api/admin/sack`, `/api/admin/managers/sack`, WhatsApp admin sack in `lib/manager-mgmt.ts`) still notify nobody but the sacked manager — deliberate, since the admin performed those themselves.
- No WhatsApp message was added (the user chose in-app + browser push only).

## Cross-references

- The sack flow this extends: `.opencode/context/user-based-competitions/sack-keeps-club-managerless-forfeits_2026-09-30.md`
- Slot/vacancy model the sack feeds: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`
- Original auto-sack feature (DEVLOG "Phase 10"): `DEVLOG.md`

## Restore File Section

| Original path | Purpose | New path |
| --- | --- | --- |
| N/A | No files removed | N/A |
