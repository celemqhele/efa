# Postponements: one open request per manager + 1-day cooldown after an approved one, plus the limbo cleanup

Added the user's follow-up postponement rule: a manager may only hold **one
pending postponement request at a time** (across every match, not just the same
fixture), and after a request is **approved** they must wait **1 day** before
asking for another. Only approved requests start the cooldown — a declined or
auto-expired request never does. This is enforced in the app and, for the
one-at-a-time half, in the database by a new partial unique index (migration
103). While doing this the user also asked to verify every auto-confirm /
auto-resolve mechanism and clear any fixture left in limbo by the older rules,
so a one-off repair declined the stale requests and finalised the one stuck game.

Follows up
`.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
(which introduced the 24h response window, the hourly auto-decline cron, and the
auto-backdoor on explicit decline). That file set the rule as "one pending
request per match"; this file tightens it to "one per manager" and adds the
cooldown.

## Decisions (confirmed with user)

- **One at a time = one PENDING request per manager.** A pending request
  anywhere blocks a new one. (Answered: "Pending blocks new ones".)
- **Cooldown starts on approval only.** Declined or auto-expired requests are
  free and never start a cooldown. (Answered: "On approval only".)
- **Applies to the requester only** (the manager who asks to move the match),
  not the opponent who answers. (Answered: "The requester only".)
- **"Cancel" the limbo:** apply the 24h rule to the existing pending requests,
  then resolve the one genuinely stuck game. Initially the user chose "let the
  report stand, 3-0 to Highbury", then changed it to **"actually no put 0-0"** —
  so the late report is dismissed and the game is finalised as a both-absent 0-0.

## Problem

1. The only limit on requests was per fixture (`postpone_requests_pending_fixture_idx`,
   migration 096), so one manager could hold several open requests across
   different matches at once. There was also no cooldown: a manager could
   immediately ask for another the moment one was approved.
2. The earlier rules left fixtures stuck: the pre-`b1404e8` daily cron **skipped**
   any fixture with a pending postponement request and the hourly expire cron did
   not exist yet, so an unanswered request left its fixture un-finalised forever.
   Four existing requests were already far past the new 24h window, and one of
   them (Supersport vs Highbury, 2026-10-12) was the only overdue unplayed
   fixture in the league because of it.

## Fix

### `supabase/migrations/103_postpone_one_pending_per_manager.sql` (NEW)

- `CREATE UNIQUE INDEX IF NOT EXISTS postpone_requests_pending_requester_idx ON
  public.postpone_requests (requested_by) WHERE (status = 'pending');` — at most
  one pending row per requester. Idempotent. The older per-fixture index stays
  (it is still what stops the OPPONENT opening a second request on one match).
- Applied live via `npm run db -- supabase/migrations/103_...sql` after checking
  no manager already held 2+ pending requests (0 rows). The cooldown half is
  time-based and stays in the app.
- Note: the repo tracks applied migrations only up to `097` in
  `supabase_migrations.schema_migrations` (098-103 are not recorded); followed the
  recent practice of just running the SQL file.

### `lib/submit-match.ts`

- Added **`POSTPONE_COOLDOWN_HOURS = 24`** next to `POSTPONE_RESPONSE_HOURS`.
- `buildState` now loads the viewer's own `pending` + `accepted` requests (any
  fixture) and derives:
  - `myOtherPending` — a pending request on a DIFFERENT fixture (the current
    fixture's own pending request is already handled by `postponeRequest`, so it
    is excluded to avoid clashing with the "already asked" card);
  - `myCooldownUntil` — max `responded_at ?? updated_at` among approved requests
    + 24h, only when it is still in the future.
- `postponeBlock` gained two reasons (after the existing admin message so admin
  behaviour is unchanged): "You already have a postponement waiting… Only one at
  a time" and "You can only postpone one match a day. You can ask again after
  <time>." (SAST-formatted). The action menu already greys out on `postponeBlock`
  and shows the reason as the sub-text.

### `app/api/submit-match/route.ts`

- Imported `POSTPONE_COOLDOWN_HOURS`.
- `requestPostpone` (server-side, authoritative) now, after the existing
  per-fixture check and before the insert:
  - rejects when the manager has a pending request on another fixture;
  - rejects when their most recent **accepted** request is less than 24h old
    (queried by `status='accepted'`, newest `updated_at`, using
    `responded_at ?? updated_at`), with the retry time in the message.
  - the `23505` handler message was widened to "You or this match already has a
    postponement request waiting. Only one at a time." (the new index can trip it
    too).

### `app/submit-match/[code]/_portal.tsx`

- Postpone menu sub-text now reads "…and give a reason (one at a time)".
- `PostponePanel` gained a line: "You can only have one postponement open at a
  time, and after one is approved you must wait a day before asking for another."

### `scripts/resolve-postpone-limbo-2026-10-16.ts` (NEW, one-off repair)

Mirrors `app/api/cron/expire-postpone-requests/route.ts` and
`finaliseZeroZero()` in `app/api/cron/auto-finalise-prev-day/route.ts`. Run once
via `npx tsx`:

- **Part 1** declined 4 pending requests older than 24h (Polokwane City vs TUT FC,
  Univ. of Pretoria vs Leicesterford City, North West Univ. vs Durban City, and
  Supersport vs Highbury), notified each requester, and wrote `audit_log`
  `postpone_request_expired` rows. It left the one fresh request
  (Sekhukhune United vs Supersport, filed 2026-10-15 20:21) untouched.
- **Part 2** resolved the stuck fixture `23cbb384` (Supersport 0-0 Highbury):
  dismissed the late not-responding report Highbury filed on Oct 15 (outside the
  new 1-day window), then finalised a **both-absent 0-0** (played++, 0 points,
  absent++, -3 GD each via `isDoubleForfeit` in `lib/standings-engine.ts`),
  set the fixture `confirmed`, notified both managers, audited
  `finalise_result`, and recalculated Betway Premiership standings.
- Idempotent: declines no-op once done, and Part 2 bails if a result exists.

## Verification

- `npx tsc --noEmit` clean; `npx next lint` on all touched files clean;
  `npx next build` succeeded.
- Live DB: `postpone_requests_pending_requester_idx` present; after the repair
  only 1 pending request remained (the fresh one); the "overdue unplayed
  fixtures" check returned 0 rows (no limbo); `23cbb384` is `confirmed` with
  `results 0-0` and `override_reason = 'Both teams absent - auto-finalised (0-0,
  no points)'`; Supersport/Highbury standings gained the expected absent++/-3GD.
- **Deploy gap found:** `/api/cron/expire-postpone-requests` returned **404** in
  production at the time of this work while `/api/cron/auto-finalise-prev-day`
  returned 401 and had run (39 `auto_finalised` audit rows, latest 2026-10-16
  00:42). The new hourly cron only reaches production with the deploy of commit
  `b1404e8`/this commit; re-check it returns 401 (not 404) after the push.
  Local `CRON_SECRET` is empty in both `.env.local` and `.env.prod`, so the live
  cron endpoints could not be called from the CLI (`dryRun` verification was
  done from the DB instead).

## Deliberately not changed

- Accept still locks 3-0 to the acceptor and moves the fixture (unchanged).
- The hourly expire cron and the daily auto-finalise cron logic itself was not
  touched — only verified.
- No `expired` status: auto-decline still reuses `declined`.

## Context chain (by path)

- Introduced the 24h window + hourly auto-decline cron + auto-backdoor on
  decline (set the rule as one-per-MATCH):
  `.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
- Original per-fixture pending index (migration 096):
  `.opencode/context/migration-history/096-submit-match-portal_2026-10-07.md`
- Prior postpone-window contract:
  `.opencode/context/submit-portal/portal-postpone-window-and-status_2026-10-08.md`
- Standings both-absent / double-forfeit handling:
  `lib/standings-engine.ts` (`isDoubleForfeit`)

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
