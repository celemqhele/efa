# Postpone: a lapsed request no longer blocks a manager, and the portal never hides a real error again

Fixed the reported "someone tried to postpone and it said something went wrong"
bug in the match portal. Two independent defects produced it: (1) a postponement
request whose 24h answer window had already lapsed still counted as "live", so it
blocked the manager from asking again — and, because the partial unique indexes
from migration 103 only look at `status = 'pending'`, the new row was rejected
outright with 23505; and (2) any unexpected throw anywhere in
`app/api/submit-match/route.ts` escaped the route as Next's HTML 500 page, which
the client cannot parse, so the manager got the useless generic
"Something went wrong. Try again." with no reason attached. Also fixed a
long-standing `onConflict` typo that made every portal result submission log
`column "rc_unique_fixture_submitted" does not exist`, and aligned the portal's
postpone date picker with the server's SAST matchday keys.

Follows up
`.opencode/context/submit-portal/postpone-one-at-a-time-and-cooldown_2026-10-16.md`
(the "one open request per manager" rule + migration 103 partial unique indexes)
and `.opencode/context/submit-portal/postpone-expire-cron-daily-on-hobby_2026-10-16.md`
(which moved the auto-decline cron to a **daily** schedule because the Vercel
Hobby plan rejects anything more frequent). The daily cadence is what turned the
old "one-at-a-time" rule into a trap: a request that lapsed overnight stayed
`pending` in the DB for up to ~24h more, and every reader treated it as live.

## Problem

The user reported: *"someone tried to postpone and it said something went wrong"*.

Diagnosis (production data + Vercel logs, 2026-10-17):

1. `public.postpone_requests` held exactly one `pending` row: `siyethemba_` on
   **Sekhukhune United vs Supersport**, created `2026-10-15T20:21:54Z`. Its 24h
   window had lapsed on `2026-10-16T20:21Z`, but the daily expire cron (23:30 UTC)
   had not yet swept it — the previous sweep (10-15 23:30 UTC) ran while the row
   was only ~3h old, so it was correctly skipped. This is exactly the ~24h lag
   the daily Hobby schedule introduces.
2. While the row lingered, it was treated as live everywhere:
   - `lib/submit-match.ts` `buildState` set `myOtherPending` for **any**
     `status = 'pending'` row, so the postpone menu item was disabled on the
     manager's other matches.
   - `requestPostpone` returned *"You already have a postponement waiting for an
     answer…"* for any pending row held by the manager.
   - Worst of all, `postpone_requests_pending_requester_idx`
     (`UNIQUE (requested_by) WHERE status = 'pending'`) and
     `postpone_requests_pending_fixture_idx` reject the replacement row with
     `23505`, so even a deliberate retry could not land.
3. Separately, `POST`/`GET` in `app/api/submit-match/route.ts` had **no
   try/catch**. Any throw → Next HTML 500 → `res.json()` fails client-side →
   `_portal.tsx` falls back to `'Something went wrong. Try again.'`, which is the
   exact string the manager reported.
4. `submitResult` wrote its mirror row with
   `{ onConflict: 'rc_unique_fixture_submitted' }` — a **constraint name**, while
   every other call site (and PostgREST itself) wants the **column list**. Even
   though the constraint exists in the DB, every portal result submission logged
   `[submit-match] confirmation upsert failed: column "rc_unique_fixture_submitted"
   does not exist`. It was caught and non-fatal, so nobody noticed.
5. `PostponePanel` computed the date picker's `min`/`max` from the **browser's**
   local date, while `requestPostpone` validates against
   `getSastDateKey()` (`lib/app-time.ts`, fixed UTC+2). Around SAST midnight a
   device in another timezone could be offered a date the server then rejects
   with *"The new date must be in the future."* / *"Pick a date within the next
   7 days."*

## Fix

**`lib/submit-match.ts`**

- New exported `postponeRequestIsLive(row, now?)`: a `pending` row is live only
  while `now - created_at <= POSTPONE_RESPONSE_HOURS`. This is the single source
  of truth for "does this request still hold its slot", mirroring the cron's
  `created_at < now - 24h` cutoff.
- `buildState` now selects `created_at` on the viewer's own requests and uses
  `postponeRequestIsLive` for `myOtherPending`, so a lapsed request no longer
  disables the postpone menu.

**`app/api/submit-match/route.ts`**

- New `unexpected(context, e)` helper: logs the full error to the Vercel logs and
  returns JSON `{ ok: false, error: 'Something went wrong on our side (<action>):
  <detail>' }` with status 500. `GET` and `POST` are both wrapped in try/catch, so
  the client can always parse a reason instead of showing the generic fallback.
- New `declineLapsedPostponeRequests(admin, requestedBy, fixtureId)`: on-demand
  mirror of the daily expire cron — declines any `pending` row older than 24h
  that this manager holds, or that already sits on this fixture, then
  audit-logs it as `postpone_request_expired` (with `settled_on_demand: true`).
  Called at the top of `requestPostpone` (before the one-at-a-time and
  same-fixture checks) and from `respondToPostpone`'s expiry guard (so its
  "…so it was declined" message is now literally true). Idempotent; both columns
  are indexed.
- `requestPostpone` re-ordered: the per-manager "one at a time" check now runs
  before the same-fixture check, both read `created_at`/`status` and gate on
  `postponeRequestIsLive`, and both use `.limit(1)` (not `.maybeSingle()`) so a
  data anomaly can never make the read itself error.
- `submitResult`: `onConflict: 'rc_unique_fixture_submitted'` →
  `'fixture_id,submitted_by'`, matching `app/api/results/confirm/route.ts:77`,
  `app/api/admin/backdoor/approve/route.ts:92` and the webhook.

**`app/submit-match/[code]/_portal.tsx`**

- `PostponePanel` derives `min`/`max` from a new local `sastDateKey(offsetDays)`
  (fixed +2 offset, mirroring `getSastDateKey`), replacing the browser-local
  `isoDate(addDays(new Date(), n))` helpers (both removed).
- The panel only shows the "You already asked to move this game…" card while the
  request is **live** (`requestLive`); once it lapses it shows the form again with
  a warning that the earlier request no longer counts.

**Data repair**

- Re-ran `scripts/resolve-postpone-limbo-2026-10-16.ts`, whose PART 1 performs the
  same global decline sweep (PART 2 is idempotent and skipped — that fixture
  already had its 0-0). It declined the last lapsed row
  (`b37dfba0-…`, Sekhukhune United vs Supersport, requester `siyethemba_`) and
  verified `stale pending remaining: 0`.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint` on all four changed files — clean.
- `select count(*) from public.postpone_requests where status='pending'` — `0`.
- Repair script output: `declined b37dfba0-… (Sekhukhune United vs Supersport)`,
  `stale pending remaining: 0`, `Repair complete and verified`.

## Notes

- The daily cron is unchanged and remains the global safety net; the on-demand
  decline only exists to close the up-to-24h gap it leaves on the Hobby plan.
  `vercel.json` / `app/api/cron/expire-postpone-requests/route.ts` were not
  touched.
- The companion WhatsApp-side fix (the bot's Groq key env name) is recorded in
  `.opencode/context/whatsapp-results/groq-api-key-env-name-mismatch_2026-10-17.md`.
