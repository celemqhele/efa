# Auto-Finalise Previous-Day Unplayed Fixtures (02:00 SAST cron)

Added a daily cron (`app/api/cron/auto-finalise-prev-day/route.ts`) that, every
day at 02:00 SAST (00:00 UTC via `vercel.json`), automatically finalises any
previous matchday's fixtures that are still unplayed (`scheduled`, no result):
no backdoor application → confirmed 0-0 both-absent void; pending backdoor(s) →
auto-approved (single claim 3-0 to the claimant, both teams claimed → 0-0),
mirroring the manual admin approve flow and the one-off
`scripts/backdoor-both-absent-16aug.ts`. This replaces what has been done by
hand (backdoor review page approvals + the 0-0 both-absent script runs).

As part of the same change, the app's "today" day-key was reconciled to SAST
(the dashboard previously only rolled over at 00:00 UTC = 02:00 SAST).

## Problem

1. **Manual finalisation.** Every morning the admin had to manually approve
   pending backdoor submissions on `/admin/backdoor-submissions` (or via the
   WhatsApp admin review path in `app/api/webhook/route.ts`) and, when matches
   went unplayed with no backdoors, run the one-shot both-absent script to lock
   them in as 0-0 voids. Any match that slipped through stayed `scheduled`
   indefinitely.
2. **UTC day boundary.** `lib/app-time.ts` used the UTC-date prefix of the
   fixture's `scheduled_date` as the canonical "day", so the app's day rolled
   at 00:00 UTC = 02:00 SAST: at 00:00 SAST the admin dashboard still showed
   yesterday's games and only flipped at 02:00 SAST. `flip-pending` therefore
   released `confirmed_pending` results one SAST morning late (the webhook
   message promised "confirmed automatically at 00:00 on {date}").

## Fix

### New cron — `app/api/cron/auto-finalise-prev-day/route.ts`
- Guarded by `CRON_SECRET` bearer (same as `app/api/cron/flip-pending/route.ts`).
- Target set: `fixtures` with `status='scheduled'`, `scheduled_date <=
  yesterday` (SAST, via `getSastDateKey(new Date(), -1)`), no `results` row,
  and neither side the Vacant placeholder (Vacant seats stay owned by
  `sweep_vacant_slots()` from `supabase/migrations/067_vacant_sweep.sql`).
- Per fixture, branch on `backdoor_submissions` with `status='pending'`:
  - **None** → 0-0 void path mirroring `scripts/backdoor-both-absent-16aug.ts`:
    `result_confirmations` insert, `results` upsert (0-0, `finalised_by=NULL`,
    `is_abandoned=false`, `override_reason='Both teams absent — auto-finalised
    (0-0, no points)'`), fixture → `confirmed`, void any stray pending
    submissions, notify both managers (`result_confirmed` via
    `insertNotificationsAndPush`), write `audit_log` `finalise_result`.
    The `%absent%`+`%both%` reason routes the `update_standings_after_result()`
    trigger (migration 066) to the void outcome — no points either side.
  - **Pending backdoor(s)** → auto-approve mirroring
    `app/api/admin/backdoor/approve/route.ts`: 1 claim awards 3-0 to the
    claimant (the side opposite `side_claimed`) i.e. "in favour of the person
    who submitted"; 2 claims → 0-0 (existing manual semantics). Same writes as
    the approve route (no `override_reason`, so the trigger's normal outcome
    path applies), submissions → `approved` with `reviewed_at=now`, other
    pending claims on the fixture → `void_game_played`, then
    `notifyBackdoorDecision(...,'approved')` and an `audit_log` entry.
- After the loop: `recalculateStandings()` once per distinct tournament
  (flip-pending pattern) and `advanceWinner(...)` for every
  `r16/qf/sf/final` fixture touched (per product decision: KO rounds are
  included, no-backdoor KO legs included too).
- `?dryRun=1` logs the intended branch/outcome per fixture without writing.
- Idempotent: only touches `scheduled`-with-no-result, so a re-run on an
  already-finalised day does nothing.
- Scheduled in `vercel.json`: `{ "path": "/api/cron/auto-finalise-prev-day",
  "schedule": "0 0 * * *" }` (00:00 UTC = 02:00 SAST) — deliberately 2h after
  the flip-pending run at 22:00 UTC (00:00 SAST) and after the midnight result
  deadline, as the grace window for late submissions.

### SAST day-key reconciliation
- `lib/app-time.ts`: added `getSastDateKey(date, offsetDays)` (SAST = UTC+2,
  no DST, fixed-offset math) and made `getDateKeyFromDate` /
  `getAppTodayKey` return the **SAST** day. `getAppDayUtcRange` unchanged
  (`scheduled_date` is a plain `date` column, so the returned day bounds are
  timezone-agnostic).
- Consumers switched from inline UTC `today` to the SAST key:
  - `app/api/cron/flip-pending/route.ts` — flips `confirmed_pending` fixtures
    on their SAST matchday (fixes the one-morning-late release).
  - `app/api/webhook/route.ts` — `getSubmissionWindow()`, the
    `submissionBlockReason` todayKey, `sendFixturesForTeams` default date, and
    `writeResultToDb`'s `isPending` todayKey → SAST, so a 00:00–02:00 SAST
    submission for today's game is on-time, not captured as future-dated.
  - `app/page.tsx` (home upcoming) and `app/(public)/calendar/page.tsx`
    ("next fixture" boundary) → SAST.
  - `app/api/admin/generate-news-data/route.ts` — dropped the DB-CURRENT_DATE
    `getDbDateKey` in favour of `getSastDateKey()`.
  - `lib/cron/notification-logic.ts` — `getSastDateString` delegates to
    `getSastDateKey`.
- These affect only read/query boundaries against the `scheduled_date` date
  column; no schema or stored-data change.

## Notes / Gotchas

- The auto-approve 2-claim 0-0 writes no `override_reason` (exactly like the
  admin approve route), so the trigger scores it as a draw (1pt each) — that is
  the existing manual "both submitted" behaviour; the no-claim 0-0 void (no
  points) is deliberately different via the `absent` + `both` reason.
- `result_confirmations.submitted_by = NULL` is safe: `check_result_confirmations()`
  (migration 066) only acts when a home AND away manager confirmation matches.
- Race check: the `expire-backdoor-submissions` pg_cron
  (`supabase/migrations/051_backdoor_status_expiry.sql`) also fires at 00:00 UTC
  but only expires claims a week old (pending expire at `expires_at` = next
  Tuesday), so morning approvals always run well before expiry; if one ever died
  first, treating it as "no backdoor → 0-0" is the intended fallback.
- Remaining UTC-aware spot left untouched: fixture **write/scheduling** paths
  (e.g. balanced scheduler, seed scripts) that derive a `scheduled_date` from a
  UTC `today` at creation time — worth a follow-up audit, but they set an
  explicit DATE so the stored matchday is what counts.

## Verification
- `npx tsc --noEmit` clean; `npm run build` succeeds and the route table shows
  `ƒ /api/cron/auto-finalise-prev-day`; `next lint` reports only pre-existing
  warnings (unrelated files).
- Live DB check of tonight's target set (`scheduled` + `scheduled_date <=
  2026-09-16` + no result + no Vacant side): 0 fixtures right now (everything
  due before today is already resolved).
- `getSastDateKey` sanity: 21:59:59Z → same SAST day, 22:00:00Z → next SAST
  day (rollover at SAST midnight as expected).

## Related files
- Manual flow this automates: `.opencode/context/backdoor/backdoor-both-absent-16aug_2026-08-17.md`
  and `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`.
- Cron patterns copied: `app/api/cron/flip-pending/route.ts` and
  `.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md`.
- Approve semantics mirrored: `app/api/admin/backdoor/approve/route.ts`,
  `lib/backdoor-notify.ts`, and the webhook `handleBackdoorAdminDecision`.
- Vacant-slot ownership kept with the sweep: `supabase/migrations/067_vacant_sweep.sql`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |