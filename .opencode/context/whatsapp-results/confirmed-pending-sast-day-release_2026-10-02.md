# Confirmed-pending releases at the START of the matchday (SAST day-key fix)

Fixed the deferred `confirmed_pending` release so a result submitted in advance is
confirmed at **00:00 SAST on the fixture's own matchday**, as originally intended,
instead of 24 hours later. This is a follow-up to
`.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md` (which
introduced the status and the 00:00-on-the-due-date promise) and closes the known
limit recorded in `.opencode/context/auto-finalise/auto-finalise-cron_2026-09-17.md`
and `.opencode/context/user-based-competitions/sack-keeps-club-managerless-forfeits_2026-09-30.md`.

The user reported it from the app side: *Motsepe Foundation Championship · Matchday 37*
was still showing the amber "Pending" pill on the morning of its own fixture day.

## Problem

**The rule:** submit a result early → it is captured but held out of the standings as
`confirmed_pending` until the beginning of the fixture's day. Not the end of the
deadline. The deadline cron (`"30 20 * * *"` = 22:30 SAST) only sends reminders and
never touches pending fixtures, so the release is entirely
`app/api/cron/flip-pending` (`"0 22 * * *"` = 00:00 SAST) plus the SQL it calls.

**Root cause — one timezone, two definitions of "today".** Every "is this fixture
still in the future?" comparison lived in SQL and used `CURRENT_DATE`, but this
database runs on UTC (`SHOW timezone` → `UTC`) while the app's day rolls at SAST
midnight (UTC+2, no DST, see `lib/app-time.ts`). They disagree for the two hours
from 22:00–24:00 UTC — which is *exactly* when the cron runs. Two comparisons broke:

1. **Release (`flip_pending_results()`, migration 065).** The cron selects its work
   with the SAST key (`getSastDateKey()` + `.lte('scheduled_date', todayKey)`, which
   correctly matched a fixture whose matchday had just begun), then delegated the
   actual UPDATE to `WHERE scheduled_date::date <= CURRENT_DATE`. At 22:00 UTC
   `CURRENT_DATE` is still the *previous* day, so the UPDATE matched **0 rows** and
   the next possible run was 24h later. The release slipped a full day for every
   early submission.

   Live proof the cron ran and no-oped: a fixture due `2026-10-01` whose result was
   submitted `2026-09-30 21:41` UTC is `confirmed` today. At submission
   `CURRENT_DATE` was Sep 30, so the trigger had to park it as `confirmed_pending`,
   and `flip_pending_results()` is the only thing in the codebase that promotes a
   pending fixture — so the cron did fire, and the fixture waited from 00:00 SAST on
   its own matchday until 00:00 SAST the day after.

   The failure was invisible because the route reported `flipped: fixtures.length` —
   the length of its own pre-query, not the function's `ROW_COUNT` — so a no-op
   logged as a successful flip.

2. **Parking (`update_standings_after_result()`, migration 065).** The guard
   `scheduled_date::date > CURRENT_DATE` had the same problem in the other
   direction: a submission made between 00:00 and 02:00 SAST *on* the matchday was
   treated as future-dated and parked, even though the webhook had already
   classified that submission as on-time (it uses `getSastDateKey()`). The trigger
   and the webhook disagreed for that window. Both context files named above had
   flagged this disagreement as an accepted limit; it is now closed.

## Fix

### `supabase/migrations/085_confirmed_pending_sast_day.sql` (applied via `npm run db`)

- **`public.app_current_date()`** — the one canonical "today": SAST, via
  `(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg')::date`. `STABLE`, with a
  `COMMENT ON FUNCTION` explaining why `CURRENT_DATE` is wrong here.
- **Parking guard** — `update_standings_after_result()` patched **in place** off its
  own live definition (`pg_get_functiondef` → targeted `replace` → `EXECUTE`), the
  same technique and for the same anti-drift reason as
  `supabase/migrations/080_fix_both_absent_case_sensitive.sql`. `pg_get_functiondef`
  emits `CREATE OR REPLACE`, so the `on_result_insert` trigger stays attached to the
  same function OID. Guarded both ways: returns early if already patched, and
  `RAISE EXCEPTION` if the expected literal is ever absent, so it cannot fail
  silently. Change: `> CURRENT_DATE` → `> public.app_current_date()`.
- **`flip_pending_results(p_today date DEFAULT NULL)`** — now takes the day to
  release up to, defaulting to `COALESCE(p_today, public.app_current_date())`. It is
  `DROP FUNCTION IF EXISTS` + `CREATE`, not `CREATE OR REPLACE`, because the
  parameter list changes the function's identity and the old zero-arg overload would
  otherwise survive and make `rpc('flip_pending_results')` ambiguous. The UPDATE stays
  inside the function so the `on_fixture_confirmed` trigger (migration 037) still
  fires the admin notification. `COMMENT ON FUNCTION` + explicit
  `GRANT EXECUTE ... TO service_role` (server-side only) per the repo's
  belt-and-braces grants rule.
- **No data is flipped by the migration.** A correct release also needs the app's
  `recalculateStandings()` and `advanceWinner()` follow-up, which no migration or
  `pg_cron` can perform, so flipping in SQL alone would mark fixtures `confirmed`
  with standings never rebuilt — and the cron only recalculates tournaments it finds
  still `confirmed_pending`, so those rows would then be orphaned. Left for the cron.

### `app/api/cron/flip-pending/route.ts`

- Passes `p_today: todayKey` so the flip uses the same day as the SELECT that chose
  the work; the two halves of the cron now agree by construction rather than by
  coincidence.
- `flipped` is now the function's real return value, and an RPC error returns 500
  instead of being swallowed by `.rpc()`'s `{ error }`-only shape.
- Recalculate/advance behaviour is unchanged: still driven by the pre-query list.

## Deliberately not done

- **The two overdue fixtures were not force-released.** Both were due `2026-10-02`
  and are correctly released by the next cron run (`00:00 SAST` on Oct 3), or on
  demand via a one-off flip + `recalculateStandings()` run:
  - `27178bbf…` Motsepe Foundation Championship MD37 — Hungry Lions 0-12 Leicesterford City (submitted 2026-10-01 14:23 UTC, by `celemqhele`)
  - `7d69e668…` Betway Premiership MD40 — Milford 0-3 Sekhukhune United (an auto-forfeit from the sack repair, see the `sack-keeps-club-managerless-forfeits` context file)
- **`supabase_migrations.schema_migrations` was not updated** — tracking stopped
  being maintained after `064` (it is 20+ migrations behind), so adding only `085`
  would be inconsistent. Relevant to
  `.opencode/context/migration-history/backfill_schema_migrations_2026-08-16.md`.
- **Numbering: `085`, not `080`.** The folder has two `080_` files (a tracked one and
  an untracked work-in-progress from another stream), so the next free slot above the
  tracked maximum (`084`) was used.

## Verification

- `npx tsc --noEmit` clean; `npx eslint app/api/cron/flip-pending/route.ts` clean.
- `app_current_date()` returns `2026-10-02`; `pg_get_functiondef` for the trigger
  contains `public.app_current_date()`; `flip_pending_results` has identity arguments
  `p_today date`; no zero-arg overload remains.
- **Release half** (read-only): the fixed predicate matches exactly the 2 fixtures
  due today and nothing earlier.
- **Trigger round-trip, past-dated** — fired `AFTER UPDATE` on a real confirmed
  result inside a transaction aborted by a final `RAISE EXCEPTION`, so nothing
  persisted: `standings.played 50 → 51`, fixture stayed `confirmed`. Re-read
  afterwards: `played` back at `50`. Proves the `pg_get_functiondef` patch did not
  corrupt the function body.
- **Parking half**, same abort-and-report method: inserting a result for a
  future-dated fixture (`2026-10-16`) set the fixture to `confirmed_pending` and left
  `standings.played` unchanged (`4 → 4`); 0 stray result rows afterwards.
- Smoke-test SQL was run from the OS temp dir, never committed to the repo.

## Context chain (by path)

- Original status + 00:00-on-the-due-date promise: `.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md`
- Submission window that made early submission legal: `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
- SAST day-key reconciliation (named this disagreement a known limit): `.opencode/context/auto-finalise/auto-finalise-cron_2026-09-17.md`
- Same limit, second mention: `.opencode/context/user-based-competitions/sack-keeps-club-managerless-forfeits_2026-09-30.md`
- In-place trigger-patch precedent: `supabase/migrations/080_fix_both_absent_case_sensitive.sql`

## Restore File Section
No repo files were deleted. Throwaway smoke-test SQL lived outside the repo in
`C:\Users\mqhel\AppData\Local\Temp\opencode\`.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |