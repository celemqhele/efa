# Confirmed-Pending Result (deferred release) for future-dated WhatsApp submissions

Added a new `confirmed_pending` fixture status so a non-admin player can submit a
result for a game **up to 7 days in the future** via WhatsApp, with the result held
out of the standings / knockout progression / final display until 00:00 on the
fixture's due date, at which point a cron auto-flips it to `confirmed`, recalculates
standings, advances knockout brackets, and fires the admin confirmation
notification. Admins (and the dashboard finalise path) remain instant-confirmed on
any date. This extends the date-window work in
`.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
(which previously **blocked** future submissions entirely) and the already-submitted
handling in `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`.

## Problem
`date-submission-window-and-confirm-menu_2026-08-29.md` changed `getSubmissionWindow`
so the window end was `today` (window = today−7..today), meaning any game due **in the
future** was rejected outright. The user wants non-admin players to be able to submit
a result for a game due up to 7 days ahead, but the result must NOT count until the
game's actual date — otherwise a wrongly-early submission would distort the live
standings and trump/knockout logic before the match is even played.

## Fix
1. **Migration `supabase/migrations/065_confirmed_pending.sql`** (applied via
   `npm run db -- supabase/migrations/065_confirmed_pending.sql`):
   - Rebuilt `update_standings_after_result()` (and recreated the `on_result_insert`
     trigger) to add a guard at the top: after fetching `v_fixture`, if
     `scheduled_date IS NOT NULL AND (scheduled_date)::date > CURRENT_DATE` then
     `UPDATE fixtures SET status='confirmed_pending'` and `RETURN NEW` — skipping the
     standings / forfeit / predictions work entirely for future-dated games.
     Otherwise it is byte-for-byte identical to the original (migration 003). The
     `fixtures.status` column has no CHECK constraint and `lib/supabase/types.ts:243`
     types `status` as plain `string`, so no type/schema break.
   - Added `flip_pending_results()`: promotes `confirmed_pending` fixtures whose
     `scheduled_date <= CURRENT_DATE` to `confirmed`; returns `ROW_COUNT`. Called by
     the cron. Promotions fire `on_fixture_confirmed` (migration 037) → admin
     notification.
2. **Webhook `app/api/webhook/route.ts`:**
   - `getSubmissionWindow(~:57)` end is now `today + 7` (window today−7..today+7).
   - `submissionBlockReason()`: allows future games within +7 days (returns null);
     the beyond-7-days message now reads "...more than 7 days away...".
   - `writeResultToDb` (`~:3724`): `const isPending = !!(fixture?.scheduled_date &&
     fixtureDateKey(fixture) > todayKey)` with `todayKey` = UTC date (matches Postgres
     `CURRENT_DATE`). Forfeit `recalculateStandings` rewrapped in `if (!isPending)`;
     the verify block forces `confirmed` for on-time games but leaves/forces
     `confirmed_pending` for pending games; `advanceWinner` runs only `if (!isPending)`;
     the success message branches to: "Result submitted ✓ ... won't be applied to the
     standings yet — the match fixture is not released until {date}. The result will
     be confirmed automatically at 00:00 on {date}." (uses the fixture date, not the
     user's wording); admin push title is `'Result Received (Pending Release)'` vs
     `'Result Confirmed'`.
   - Added `confirmed_pending` to all relevant status lists (backdoor search,
     already-applied / override detection, date-listing buckets, format
     fixture-list status, `statusFilter`, `resultLine`, and the `.in('status', [...])`
     pick lists), so future-submitted games are visible/editable and correctly
     classified in the WhatsApp conversation.
3. **UI status maps** — `confirmed_pending` now rendered as an amber "Pending" pill /
   label across: fixtures `_desktop`, teams `[id]/fixtures` `_desktop`/`_mobile`, home
   `_desktop`/`_mobile`, admin dashboard `_desktop`/`_mobile`, admin fixtures manage
   `_desktop`/`_mobile`, teams `[id]` `_desktop`/`_mobile`, calendar grid,
   `DashboardFixtureActions.tsx:41` and `FixtureActions.tsx:46` (`isFinished`),
   `ResultSubmitClient.tsx:203` (`isFinished`).
   - Verified no-change needed: standings engines count only `status==='confirmed'`
     (so pending auto-excluded); admin dashboard completed-count and tournaments
     completed-count count only `confirmed`; home/results/teams recent-result queries
     filter to `confirmed`-class statuses (pending correctly hidden until release);
     `lib/cron/notification-logic.ts:54` day-of reminders use
     `['scheduled','awaiting_confirmation']` (pending already excluded).
4. **Cron `app/api/cron/flip-pending/route.ts`** (new) + `vercel.json` schedule
   `"0 22 * * *"`:
   - Auth via `CRON_SECRET` bearer header (mirrors `notification-cron`).
   - Pre-queries `confirmed_pending` fixtures with `scheduled_date <= today` (UTC),
     calls `flip_pending_results()`, then `recalculateStandings(tournamentId)` for each
     distinct tournament, and `advanceWinner(...)` for each KO fixture (`r16`/`qf`/`sf`/
     `final`). 22:00 UTC = 00:00 SAST.
5. **Admin future submissions stay instant** — `app/api/admin/finalise-result/route.ts`
   still forces `confirmed` and runs its own standings/progression, so the DB pending
   guard doesn't delay admin-approved results.

## Verification
`npx tsc --noEmit` clean; `npm run lint` warning-only (all pre-existing); `npm run build`
succeeds (new route `ƒ /api/cron/flip-pending` appears in the route table).
