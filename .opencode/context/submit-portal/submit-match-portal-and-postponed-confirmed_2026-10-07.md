# Submit-match portal: postponement agreement + result web UI (2026-10-07)

Built the `/submit-match/[code]` web portal end-to-end: a login-gated page where the two managers
of a fixture can (1) submit the real result with a proof screenshot, (2) report an opponent as
not responding (backdoor), (3) view match details, and (4) request a postponement — the opponent
accepts or declines through the same link. It replaces the bot's match-centre (MC) code flow
(removal documented in `.opencode/context/match-codes/match-code-portal-url-and-webhook-removal_2026-10-07.md`).

## Problem

The league managers only had the WhatsApp bot command/backdoor flows, which (per the session
investigation) were unreliable in delivery. Match codes already existed per fixture (see
`.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`), so the natural
improvement was a web submission portal reachable at `https://efa-fxyk.vercel.app/submit-match/<code>`,
and a proper postponement workflow with the opponent's consent.

## Fix — the data model

- Migration `supabase/migrations/096_submit_match_portal.sql` (applied via `npm run db`, then
  `npx tsx scripts/backfill-migration-history.ts` ran → 36 rows inserted, total tracked 95):
  - `fixtures.postponed_confirmed boolean not null default false` — an agreed postponement
  - `postpone_requests` table (`fixture_id`, `requested_by`, `requested_by_phone`, `new_date`,
    `reason`, `status`, `responded_by`, `responded_at`, partial unique `(fixture_id) where status='pending'`,
    grants for `service_role`, `authenticated` — belt-and-braces per AGENTS.md)
  - `match-screenshots` storage bucket; `results` already had `screenshot_url`.
- Semantics: on acceptance the fixture is updated to `status='confirmed'`, `postponed_confirmed=true`,
  `is_postponed=true`, `postponed_from=old date`, `scheduled_date=new date`, and a locked result
  `3-0` (acceptor wins) is upserted with `override_reason='postponement agreed'` (must NOT contain
  `absent`/`both` — the standings trigger reads those words). Standings update immediately
  (`recalculateStandings`). The real result can still be submitted on/after the new date; submitting
  it clears `postponed_confirmed` and replaces the placeholder. This design avoids a new status
  string: `lib/standings-engine.ts` only counts `confirmed`, and the v065 triggers only rewrite
  `confirmed`/`confirmed_pending`.
- The auto-finalise cron (`app/api/cron/auto-finalise-prev-day/route.ts`) now clears
  `postponed_confirmed` for placeholder fixtures whose moved date has passed (and advances KO winners
  via the placeholder result), so a match played on its moved date without a submitted score rolls
  forward normally.

## Fix — the code

- `lib/submit-match.ts`: shared state builder `buildState` + gates (`windowBlock`, on the same
  today-7..today+7 window as the bot), `loadFixture` (embeds teams/result/postpone request),
  `resolveViewer`, `uploadToBucket`, `labelDate`, `APP_BASE`.
- `app/api/submit-match/route.ts`: `GET` returns portal state; `POST` handles `result`,
  `backdoor`, `postpone`, `postponeRespond`. Auth via `createClient` user; writes via
  `createAdminClient`. Audit-log entries `portal_*`. Auto-voids pending/approved backdoor reports
  when a real result lands; advances KO rounds after a real (non-future) result.
- `app/submit-match/[code]/page.tsx`: server page — uppercases the code, creates the Supabase client
  (this route is NOT covered by the middleware matcher, so auth state is read client-side and the
  login gate uses a `SupabaseClientForBrowser` + `?redirect=` back), shows `code not found` /
  `not a manager` cards.
- `app/submit-match/[code]/_portal.tsx`: full client UI — header Card + status Pill, result bar
  (with a `placeholder` tag when `postponed_confirmed`), postpone-respond card with a two-step
  `confirmAccept`, error banner, 4-button menu (disabled + block reason shown), `ResultPanel`,
  `BackdoorPanel` (manager's side auto-picked; admin gets a side select), `DetailsPanel` (fixture
  rows, result + screenshot link, backdoor reports with screenshots, pending postpone request),
  `PostponePanel` (min = tomorrow, max = +7 days), success modal with Copy link / WhatsApp share,
  `formFor(action, fields)` FormData builder, `refresh()` via the GET endpoint.
- Reminder links: `components/ui/DashboardFixtureActions.tsx` now builds portal links
  (`PORTAL_BASE = https://efa-fxyk.vercel.app/submit-match` + match code + optional `?action=backdoor`)
  and the ⚠️ "JUST HIT SEND" line was dropped from the reminder template.

## Fix — `postponed_confirmed` read-side wiring (the due/upcoming lists)

The flag makes an already-NOT-played game invisible to any code that only reads `status`.
Standard pattern applied everywhere: include fixtures where `status in (scheduled, awaiting_confirmation)`
OR `(status=confirmed and postponed_confirmed=true)`.

- Admin dashboard due query (`app/(admin)/admin/dashboard/page.tsx`) uses
  `.or('status.in.(scheduled,awaiting_confirmation),and(status.eq.confirmed,postponed_confirmed.eq.true)')`
  (PostgREST `.or()` calls are AND-ed, verified in the postgrest-js source) — its completed counts
  exclude `postponed_confirmed`. Desktop/mobile fixtures-tables pass `postponedConfirmed` to the row
  components; the desktop export labels them `scheduled`.
- Admin results submit page + `ResultSubmitClient.tsx`: `Fixture.postponed_confirmed?`, pending query
  gets the `or(..)` AND pattern, completed query `.neq('postponed_confirmed', true)`, `isFinished`
  excludes the flag, badge + row show `postponed`.
- Admin fixtures manage page: query selects the flag; `FixtureActions.tsx` gets a `postponedConfirmed`
  prop — keeps the Submit button, hides Postpone/Batch Postpone, and the Reset Result button still
  works (admin can undo the placeholder).
- Public pages: home upcoming widget (`app/page.tsx`, `app/_desktop.tsx`, `app/_mobile.tsx`), public
  fixtures list, team fixtures + team page, calendar (`CalendarGrid` gained
  `FixtureSummary.postponed_confirmed?`), profile "next fixture", admin export page — all use the
  same `or(..)`/`neq` pattern and render a `Postponed` badge/pill instead of hiding the game or
  showing the placeholder score.
- Fixture detail page (`app/(public)/fixtures/[id]/page.tsx` + `_desktop.tsx`/`_mobile.tsx`): shows a
  `Postponement agreed` note under the score and, when the result has a `screenshot_url`, a
  `View screenshot` link (matches the public results page pattern; opponent-not-responding report
  screenshots were intentionally NOT exposed here — they are admin-only on the backdoor submissions
  page).

## WhatsApp bot — flag-aware

- `formatFixtureLine`/`isFixtureConfirmed` in `app/api/webhook/route.ts` treat a
  `postponed_confirmed` fixture as still-to-be-played: it lists as "Home vs Away" (no `(SUBMITTED)`
  score), and submission flows continue to it instead of claiming "already applied".
- The first-time submission lists and the free-text team search (`statusFilter`) include the flag
  fixtures on the `new` path and exclude them from the `fix` path. Backdoor gates give a clear
  "was postponed and is still to be played" message instead of "already processed 3-0".

## Files

- `C:\Users\mqhel\efa\supabase\migrations\096_submit_match_portal.sql`
- `C:\Users\mqhel\efa\lib\submit-match.ts`
- `C:\Users\mqhel\efa\app\api\submit-match\route.ts`
- `C:\Users\mqhel\efa\app\submit-match\[code]\page.tsx`, `_portal.tsx`
- `C:\Users\mqhel\efa\components\ui\DashboardFixtureActions.tsx`
- `C:\Users\mqhel\efa\app\api\cron\auto-finalise-prev-day\route.ts`
- the ~20 read-side files listed above