# Auto-finalise the morning AFTER the match day (interim 0-0 / backdoor approval)

Moved the auto-finalise cutoff from "two days after the match day" back to "the
morning after the match day", so an unplayed fixture becomes a confirmed 0-0 (or
an auto-approved backdoor result) straight away instead of sitting `scheduled`
for a whole extra day, and added a `?cutoff=YYYY-MM-DD` override so a missed run
can be caught up on demand.

Follow-up to `.opencode/context/auto-finalise/auto-finalise-cron_2026-09-17.md`
(the cron itself) and to
`.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
(which brought in the match-day +1 grace window): after that change the admin
reported that games from the previous day were still not confirmed, and that a
backdoor report filed for Magesi vs AmaZulu had apparently been "deleted by the
system" because the fixture still read 0-0.

## Problem

1. **A game nobody played stayed unconfirmed for an extra day.** The cron ran at
   02:00 SAST with `finaliseCutoff = getSastDateKey(now, -(GRACE_DAYS + 1))`,
   i.e. *today - 2*, so a Sunday fixture was only finalised on Tuesday morning -
   the whole of Monday (its grace day) it was still `status='scheduled'` with no
   result, holding up the table and looking to everyone like nothing had been
   submitted. The admin asked for the 0-0 placeholder "in the meantime", with
   the real score still submittable inside the 24h post-deadline window.
2. **The "deleted backdoor" was a false alarm - nothing was deleted.** The
   report for Magesi vs AmaZulu (`backdoor_submissions`
   `c36fd7e4-ec06-4a9c-9f66-8950a3dbdd80`, fixture
   `ca647ce0-5804-49e2-b0b4-8f02f9c91032`) was present with its screenshot,
   `status='pending'`, `reviewed_at = null`, and the only audit entry was
   `portal_backdoor_submitted`. A pending report has **no** effect on the score
   until it is approved, so the game still displayed as unplayed/0-0; what the
   manager showed the admin was the portal's submission receipt ("Under review"),
   not an approval. The fix was therefore not to restore anything but to run the
   approval that the stale cutoff had postponed.
3. **What *does* look like deletion:** `void_game_played`. In
   `app/api/submit-match/route.ts` (submitResult, ~L323-329) submitting a real
   result for a non-future match sets every `pending` **and** `approved` report
   on that fixture to `void_game_played` ("the game was actually played, so the
   claim is moot"); `autoApprove()`/`finaliseZeroZero()` do the same. That is why
   four recent reports show up as `void_game_played` (e.g. Wits Sport vs Orlando
   Pirates, 18 Oct - a result was submitted 7 minutes after the report).

## Fix

`app/api/cron/auto-finalise-prev-day/route.ts`

- `finaliseCutoff` is now `getSastDateKey(new Date(), -GRACE_DAYS)` (yesterday)
  instead of `-(GRACE_DAYS + 1)`. At 02:00 SAST the games from the day before are
  finalised - no pending report -> confirmed 0-0 (both absent, no points);
  pending report(s) -> auto-approved (single claim 3-0 to the claimant, both
  sides claimed 0-0), exactly the previous outcomes, one day earlier.
- The grace window is unaffected, so the placeholder is genuinely interim: a 0-0
  void and an auto-approved backdoor are deliberately **not** "real results"
  (`finalised_by`/`screenshot_url` both null), so `submitResult` still accepts a
  first-time score for the fixture and it replaces the placeholder (see
  `isRealResult` / the `isBackdoorResult` branch in `app/api/submit-match/route.ts`).
  A real score also voids the report, so the placeholder cannot linger.
- Added `?cutoff=YYYY-MM-DD` (validated) for a manual catch-up run, and
  `?dryRun=1` already existed.
- The postponed-confirmed flag clearing keeps its **old** cutoff
  (`postponedClearCutoff = -(GRACE_DAYS + 1)`) so the "postponed to ..." context
  stays on the fixture while the moved day is still playable; only the
  unplayed-game finalisation moved earlier.

`scripts/run-auto-finalise.ts` (new, reusable)

- Runs the real route module in-process (`GET()` with a synthetic request) so a
  catch-up needs no HTTP auth. This exists because the production `CRON_SECRET`
  is a Vercel *sensitive* env var and cannot be read back - `.env.local` has
  `CRON_SECRET=` (blank) and `vercel env pull` returns it empty - so the deployed
  endpoint cannot be called by hand.
- Usage: `npx tsx scripts/run-auto-finalise.ts [YYYY-MM-DD] [--dry]`.

## Data repair (2026-10-19)

Ran the catch-up for yesterday (matchday 2026-10-18), which touched exactly the 6
fixtures that were still `scheduled` - no older stragglers:

| Fixture | Outcome |
| --- | --- |
| Supersport vs Milford | 0-0 both absent (no report) |
| University of Pretoria vs Venda FC | 0-3 (Venda FC claim approved) |
| Magesi vs AmaZulu | 0-3 (AmaZulu claim approved) |
| Ben 10 vs Kaizer Chiefs | 0-3 (Kaizer Chiefs claim approved) |
| Orbit College vs The Bees | 3-0 (Orbit College claim approved) |
| Leicesterford City vs Gomora United | 3-0 (Leicesterford City claim approved) |

Result: `processed 6, finalised 1, approved 5, failed 0`; all six fixtures now
`confirmed`, `select count(*) from fixtures where status='scheduled' and
scheduled_date <= '2026-10-18'` = 0, standings recalculated for both tournaments,
`Result Confirmed` + `Backdoor Approved` notifications inserted. Web-push was not
sent because the run was local (VAPID keys are blank in `.env.local`); the in-app
notifications are in the DB.

## Verified

- `npx tsc --noEmit` and `npx eslint app/api/cron/auto-finalise-prev-day/route.ts`
  clean.
- Dry run then real run via `scripts/run-auto-finalise.ts 2026-10-18`.
- Deployed with `vercel --prod`
  (`dpl_2bsgkc2EcBa6Wu82cjohLeBrFRo9`, `efa-fxyk-2yuyn65oq`); `https://efa-fxyk.vercel.app`
  resolves to it, status Ready.

## Notes / not addressed

- Old pending reports on **already-resolved** fixtures (e.g. University of
  Pretoria vs Ben 10, 16 Oct) are never revisited: the cron only looks at
  `status='scheduled'` fixtures, so a report filed *after* the fixture was
  settled stays `pending` forever. Housekeeping candidate, not touched here.
- `notifyBackdoorDecision` notifies the claimant but not the accused, so the
  side that loses a claim learns about it from the fixture/notifications page
  rather than a push.

## Restore File Section

No file was removed. One scratch probe created during this session was moved to
`.recycle/` per the repo deletion policy:

- Original path: `scripts/_probe-alias.ts` - purpose: throwaway check that tsx can
  import the cron route module (with its `@/` aliases) from a script.
  New path: `.recycle/scripts/_probe-alias.ts`.
