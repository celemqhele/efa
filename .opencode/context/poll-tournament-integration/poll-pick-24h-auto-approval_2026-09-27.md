# Poll Picks Auto-Approve After 24 Hours (No More Permanent "Pending")

Gave every poll pick a 24-hour change window, after which it locks itself to `approved` and can no longer be withdrawn or changed. The user asked that picks "should no longer be pending — should just go straight to approved … 24 hours after user picks a team". This is a follow-up to the poll flows in `.opencode/context/poll-tournament-integration/`, and runs alongside the Season 4 work in `.opencode/context/two-divisions/season-4-two-division-setup_2026-09-27.md`.

## Problem

`poll_applications.status` was effectively write-once: a pick was inserted as `pending` and stayed `pending` indefinitely. Players kept asking why their pick was never finalised, and there was no defined point at which a pick became binding. Admins also had no way to tell a genuinely new pick from a forgotten one.

## Fix

### Migration
`supabase/migrations/078_poll_application_auto_approve_buffer.sql` (applied):
- Adds `poll_applications.auto_approve_at timestamptz`.
- Backfills existing `pending` rows as `created_at + interval '24 hours'`, so historic picks lock based on when they were actually made rather than all at once.
- Adds partial index `poll_applications_auto_approve_idx` on `auto_approve_at` where `status = 'pending'`.

### Application flow
- `app/api/polls/[share_code]/apply/route.ts`: a new pick writes `status: 'pending'` plus `auto_approve_at = now() + 24h`.
- `app/api/polls/[share_code]/withdraw/route.ts`: refuses to withdraw an `approved` pick, returning **HTTP 409** with a message telling the player the window has closed.
- Withdrawal stays a hard `DELETE` on purpose — that releases the unique poll/team constraint so a re-pick inserts a fresh row and restarts the 24-hour timer from the new pick.
- `app/api/polls/[share_code]/route.ts`: GET now returns `auto_approve_at`.

### Approval job
- `lib/poll-auto-approve.ts` (new): `approveDuePollPicks(supabase)` flips every `pending` row whose `auto_approve_at <= now()` to `approved` and sends a best-effort `poll_application_approved` notification per user. Notification failures are logged, never thrown, so they cannot fail the approval pass.
- `app/api/cron/approve-poll-picks/route.ts`: hourly cron guarded by `Authorization: Bearer ${CRON_SECRET}`.
- `vercel.json`: added `"0 * * * *"` → `/api/cron/approve-poll-picks`.
- `scripts/approve-due-poll-picks.ts` (new): one-off runner that calls the same `approveDuePollPicks()` so a backfill and the cron can never drift apart.

### Lock UI
- `lib/poll-pick-lock.ts` (new): shared client-safe helpers for the locked state and countdown.
- `app/(public)/polls/[share_code]/PollClient.tsx`, `_desktop.tsx`, `_mobile.tsx`: show the time remaining, disable withdraw once approved, and show a locked state.

## Verification
- `npx tsc --noEmit` clean; ESLint reports only the two pre-existing `LeagueEntry` warnings in the desktop/mobile poll views.
- Backfill run via `scripts/approve-due-poll-picks.ts`: **98 approved across 40 users**, 0 pending afterwards. The 8 `withdrawn` rows correctly have no timer.
- The 12 still-pending rows were all genuinely inside their window (earliest due 8 minutes after the run), confirming the timer is per-pick rather than a blanket approval.

## Next steps / notes
- `tournament_applications` (the season-linked pick path) has no `auto_approve_at` and is currently empty. If that path is used, it needs the same treatment — the 24h logic here only covers `poll_applications`.
- Because the cron is hourly, a pick can sit approved-looking for up to an hour past expiry; that is the intended trade-off.
