# Shortened deadline rules: match day +1 grace, 24h postpone response, auto-decline cron, auto-backdoor on decline

Implemented a batch of new EFA deadline/postponement rules across the portal,
WhatsApp bot, and crons: result/backdoor/postpone submissions are only open on
the match day plus the next day (was 7 days); a postponement request's
accept-or-decline window is now 24 hours with an hourly auto-decline cron and
browser push to the requester; and an *explicit* decline now auto-files a
not-responding (backdoor) report for the decliner against the requester, since
the decliner wanted to play on the scheduled day and the requester cannot. This
replaces the 7-day grace / 7-day postpone-response contract.

Follows up (and supersedes the 7-day parts of)
`.opencode/context/submit-portal/flash-lite-review-grace-period-and-mojibake_2026-10-10.md`,
`.opencode/context/submit-portal/portal-postpone-window-and-status_2026-10-08.md`,
and `.opencode/context/submit-portal/portal-grace-period-ended-note_2026-10-08.md`.

## Decisions (confirmed with user)

- Grace window for submissions/reports/postpone-requests = **match day + next
  day** (`GRACE_DAYS = 1`). Blocked from 2 days after the match day.
- Postpone request + response window = **24 hours** (`POSTPONE_RESPONSE_HOURS`).
  Auto-declined after that.
- One pending postpone request **per match** (already enforced by the partial
  unique index `postpone_requests_pending_fixture_idx`).
- Auto-decline is delivered by a **new hourly cron** (not the daily finaliser).
- Push to the person who must answer the postpone, deep-linked to the accept
  page (`push_url` = the `/submit-match/{code}` portal link).
- Keep the existing rule that **accepting a postpone locks a 3-0** to the
  acceptor (requester loses 0-3); the match stays on the new date so it can
  still be played and submitted for real.
- **Auto-backdoor on decline: explicit decline only.** A 24h no-answer timeout
  cancels the request with **no** backdoor filed. The auto-filed backdoor is
  created as `status='pending'` (no screenshot) for **admin review**, and the
  requester **is** notified a report was filed against them.
- Admins keep unrestricted edit ability (unchanged).

## Problem

Previously a match's result, backdoor report, and postpone request/response
window all ran for 7 days after the deadline (`MAX_POSTPONE_DAYS = 7` drove
`postponeWindow`, `gracePeriodEnded`, `deadlineBlock`, and the bot's
`getSubmissionWindow` start of `today-7`). The postpone request also had a
7-day response window, and a declined request left the match on its original
date with no follow-up — the decliner had no automatic recourse even though the
requester was the one who could not play.

## Fix

### `lib/submit-match.ts`

- Introduced **`GRACE_DAYS = 1`** (the past/grace side) alongside the existing
  `MAX_POSTPONE_DAYS = 7` (now only the *future* side: how far ahead a proposed
  new date may be). Added **`POSTPONE_RESPONSE_HOURS = 24`**.
- Removed `postponeWindow` (was the 7-day past-side gate for postpone); its
  call sites were replaced with the grace window (result/report/request) or the
  24h age check (responding).
- `gracePeriodEnded` and `deadlineBlock` now key off `GRACE_DAYS` (message
  reworded to "…no longer be changed, reported or postponed.").
- `windowBlock` (and the bot's window) start at `today-GRACE_DAYS` instead of
  `today-7`; past-side message reworded to "…older than a day…". Future side
  stays `today+7`.
- `buildState`:
  - Added a deadline gate to `backdoorBlock` (past the grace window a manager
    can no longer file a not-responding report).
  - `postponeRequest` and `respondTo` now expose **`expiresAt`** (created_at +
    24h) and `postponeRequest.createdAt`.
  - Added `postponeExpired` (now > expiresAt) and gated `canRespond` on
    `!postponeExpired`, so the portal stops offering accept/decline in the gap
    between the 24h deadline and the next cron run.

### `app/api/submit-match/route.ts`

- `submitBackdoor`: added a `deadlineBlock(dateKeyOf(fixture))` guard.
- `requestPostpone`: success copy and opponent push now mention the 24h answer
  window; the opponent notification's **`push_url`** is set to the portal link
  (`shareLink`) so the push opens the accept page. Still blocks a second pending
  request (1-per-fixture).
- `respondToPostpone`:
  - Replaced the `postponeWindow` gate with a **24h age check** on
    `created_at` (declines with a clear message if expired), and now selects
    `created_at`.
  - On **explicit decline**: auto-files a `backdoor_submissions` row for the
    decliner (`submitter_phone` = decliner, `side_claimed` = requester's side,
    `status='pending'`, `screenshot_url=null`, `expires_at` = next Tuesday),
    skipped if the decliner already has a live report/dispute on the fixture;
    notifies admins via `notifyBackdoorSubmitted`; records
    `auto_backdoor_submission_id` in the audit entry; and notifies the requester
    that a report was filed (`push_url` = portal link).
  - Accept path unchanged (3-0 lock, fixture move) but now also sets `push_url`
    on the completion notification.

### `app/api/webhook/route.ts` (WhatsApp bot)

- `getSubmissionWindow` start moved from `today-7` to `today-1`; the past-side
  `submissionBlockReason` message reworded to "…older than a day…". Comments and
  doc notes updated. No `postpone_requests` logic exists in the bot
  (postponements are portal-only).

### `app/api/cron/auto-finalise-prev-day/route.ts` (02:00 SAST)

- Cutoff moved from `getSastDateKey(now, -1)` to `-(GRACE_DAYS + 1)` = **-2**,
  in both the main fixture query and the `movedPast` postponed-confirmed
  clearing, so a match always gets its full grace day before being locked.
- Pending-postpone handling reworked: instead of `postponeWindow`, each pending
  request's `created_at` age is compared to 24h. A **fresh** request (< 24h)
  keeps its fixture open (skipped this run); a **stale** one (>= 24h) is set to
  `declined` (status + responded_at, not deleted) so the fixture still gets
  finalised.

### `app/api/cron/expire-postpone-requests/route.ts` (NEW, hourly)

- Bearer-auth (`CRON_SECRET`) GET that finds `pending` requests older than
  `POSTPONE_RESPONSE_HOURS`, sets them `declined`, and sends the **requester** a
  browser push + in-app alert ("your opponent did not answer within 24 hours…")
  with `push_url` deep-linking to the portal (`/submit-match/{code}` from
  `match_codes`, falling back to `/fixtures/{id}`), plus an `audit_log` row
  (`postpone_request_expired`). **No** backdoor is filed here.

### `vercel.json`

- Added `{ "path": "/api/cron/expire-postpone-requests", "schedule": "0 * * * *" }`.

### Portal + fixture UI

- `app/submit-match/[code]/_portal.tsx`: grace banner reworded to
  "…grace period has ended… Results, reports and postponements were only open on
  the match day and the day after."; postpone menu, panel, header banner, and
  the opponent's accept/decline card all explain the 24h window; and both the
  requester's and the responder's pending views render an **expired** state
  (error-styled note, accept/decline buttons hidden) once `expiresAt` has passed.
- `app/(public)/fixtures/[id]/page.tsx` + `_desktop.tsx`/`_mobile.tsx`: the
  greyed CTA `title` and comments changed from "7 day grace period" to the
  match-day+1 grace; the Postponement card's pending state explains the 24h
  answer window.

## Verification

- `npx tsc --noEmit` clean; `npx next lint` on all touched files clean (remaining
  warnings are pre-existing, none in changed files).
- `npx next build` succeeded; `/api/cron/expire-postpone-requests` appears in the
  route table.
- DB contracts checked live via `npm run db`: `backdoor_submissions` (NOT NULL:
  fixture_id, submitter_phone, side_claimed; screenshot_url/status/expires_at
  nullable-with-defaults), `match_codes` (code, fixture_id), `audit_log`
  (admin_id nullable). `notifications.type` has no CHECK constraint, so
  `backdoor_submitted` / `fixture_postponed` are valid free-form types.
- Confirmed no remaining references to the removed `postponeWindow` export.
- Admin backdoor review UI (`BackdoorSubmissionsClient`) already guards
  `sub.screenshot_url &&`, so a null-screenshot auto-submission renders safely.

## Deliberately not changed

- `postpone_requests.status` CHECK (pending/accepted/declined) — auto-decline
  reuses `declined`; no new `expired` status was added.
- Accepting still locks 3-0 to the acceptor and keeps the postponed-confirmed
  placeholder on the new date (unchanged contract).
- No new migration: the hourly cron's query (`status='pending'` + `created_at <
  cutoff`) is already served by the existing `postpone_requests_status_idx`.

## Context chain (by path)

- Superseded 7-day window contract:
  `.opencode/context/submit-portal/flash-lite-review-grace-period-and-mojibake_2026-10-10.md`
- Prior postpone-window contract:
  `.opencode/context/submit-portal/portal-postpone-window-and-status_2026-10-08.md`
- Prior grace-period banner contract:
  `.opencode/context/submit-portal/portal-grace-period-ended-note_2026-10-08.md`
- Match-code deep links used by the new cron:
  `.opencode/context/match-codes/`

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
