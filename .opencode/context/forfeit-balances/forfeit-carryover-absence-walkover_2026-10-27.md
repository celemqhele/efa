# Carry-over forfeit scores now apply to walkovers and every absence path

Carry-over forfeit balances (the `forfeit_balances` row a forfeited match leaves behind) are now applied on **walkovers** ("opponent gave you the win", flat 3-0) and on **every single-sided absence result** — admin absent checkboxes, WhatsApp backdoor/absence approvals, vacant-slot and managerless-club auto-forfeits — not just on normally played matches and backdoor claims. A resubmitted result also now clears the forfeit it previously created when the new submission is not a forfeit. This file extends the rule documented in `.opencode/context/forfeit-balances/forfeit-carryover-discards-forfeiter-score_2026-10-11.md` (only the opponent's conceded score carries over) to the results that were previously skipped.

## Problem

Two gaps were reported by the user:

1. **"please make sure forfeit scores are applied even for take the win and also absense."**
   Walkovers and absences wrote a fixed 3-0 / 0-3 (or 0-0) and never called `applyCarryOverBalances`. So a manager who still owed a 5-0 penalty escaped it whenever the opponent simply handed them the win or failed to show up — the penalty then rolled on to some later match instead of being settled there.
2. **"second update if a player resubmits. make sure that if the first submit flagged as forfeit it gets removed if the new submit does not include it."**
   The writers only voided the previously created balance on some paths, so a corrected submission could leave a stale `forfeit_balances` row (and its effect on a later match) alive.

Semantics confirmed by the user twice, for a walkover:

> team a tells team b to take the win. so its team a 0-3 team b. but team b has a pending forfeit. 5-0. so after forfeit balance applied it becomes team a 5-3 team b.

So the base score stays, and the balance adds to the **opponent of the forfeiting manager** — the scoreboard may flip away from the textbook 0-3. The forfeiter's own score is still discarded (unchanged rule from `.opencode/context/forfeit-balances/forfeit-carryover-discards-forfeiter-score_2026-10-11.md`).

## Fix

### 1. Apply sites — the helper is now called everywhere

`lib/forfeit-balance-apply.ts` (`applyCarryOverBalances`) is the single place that decides who owes what and how much goes on which side. It gained:

- `excludeBalanceIds?: string[]` — balances the caller already applied by hand are skipped so the conceded score is not counted twice.
- It re-opens balances this same fixture consumed on an earlier submission before re-applying them, so a correction counts each balance exactly once.
- Its header comment now lists every caller (played, walkover, backdoor, absence, auto-forfeit) and notes that a double no-show void deliberately skips it.

Call sites:

| Writer | Path | What it now does |
| --- | --- | --- |
| Portal submit (walkover) | `app/api/submit-match/route.ts` | `givenWin` branch applies carry-over on top of the 3-0 and appends `forfeit_note:` lines to `override_reason`. |
| Portal submit (normal/corrected) | `app/api/submit-match/route.ts` | Normal branch always applies carry-over (the old `!isFuture` guard is gone, so an early-played result still absorbs it). |
| Admin finalise | `app/api/admin/finalise-result/route.ts` | Absent checkboxes apply carry-over on top of 0-3/3-0, skipping double-absent and `used_forfeit_balance_ids`. |
| WhatsApp result write | `app/api/webhook/route.ts` (`writeResultToDb`) | Voids stale balances, applies carry-over, writes `forfeit_note:` lines, resets abandonment flags. |
| WhatsApp backdoor side | `app/api/webhook/route.ts` (`handleBackdoorSide`, `handleBackdoorAdminDecision`) | Voids prior balances, applies carry-over, resets flags, fixes the winner notification. |
| WhatsApp backdoor approval | `app/api/webhook/route.ts` (~2829) | Same, and clears `is_abandoned`/`abandoned_type`. |
| Website backdoor approval | `app/api/admin/backdoor/approve/route.ts` | Voids stale balances + applies carry-over, always writes `is_abandoned: false`, `abandoned_type: null`, `override_reason`. |
| Auto-finalise cron | `app/api/cron/auto-finalise-prev-day/route.ts` (`autoApprove`) | Applies carry-over, writes `is_abandoned: false` / `abandoned_type: null`. |
| Vacant / managerless auto-forfeits | `lib/slot-utils.ts` | Both loops apply carry-over with the seat owner / team manager id and record `abandoned_type`. |

### 2. Double no-show is a VOID — the balance stays pending

Deliberately **not** applied/consumed when there is no winner and no scoreline:

- `finaliseZeroZero()` in `app/api/cron/auto-finalise-prev-day/route.ts` keeps a straight 0-0.
- `app/api/admin/finalise-result/route.ts` skips the apply when `bothAbsent`.
- `lib/slot-utils.ts` skips both-vacant and both-managerless fixtures.

Rationale: swallowing a penalty into an empty game punishes nobody. It stays pending and lands on that manager's next real meeting.

### 3. `abandoned_type` marks the absent side without calling it a forfeit

A carried-over score can move an absence away from 0-3/3-0, so the score alone can no longer identify who was absent. Absence results therefore record `abandoned_type: 'home' | 'away'` while keeping `is_abandoned: false`:

- every reveal of the "Abandoned" badge / `ForfeitBadge` gates on `is_abandoned`, so nothing new is rendered (`app/(public)/fixtures/[id]/_desktop.tsx`, `_mobile.tsx`, `app/(public)/results/[id]/_desktop.tsx`, `_mobile.tsx`);
- the forfeit branches (which require `is_abandoned === true`) never fire, so an absence still is not a forfeit;
- two new `absenceSides()` helpers (`lib/standings-core.ts`, `lib/standings-engine.ts`) read `abandoned_type` first and fall back to the exact 0-3/3-0 scores for legacy rows;
- `checkAndAutoSack()` in `app/api/admin/finalise-result/route.ts` prefers `abandoned_type` over the score for the same reason.

### 4. Standings credit the ACTUAL score

Both standings engines used to hard-code the winner's 3 goals on an absence. They now credit the recorded score, so an 8-5 absence result books 8 goals for the present side and still books the absent side's `absent++` / `gd_penalty -3` with no GF/GA:

- `lib/standings-core.ts` (`applyResultToRow`)
- `lib/standings-engine.ts` (`applyResult` — the rebuild used by `recalculateStandings`)
- `lib/aggregate.ts` (`resolveTournamentGdLeader`) got single-absence parity: present side +actual winner score, absent side -3; the both-absent branch still applies -3 to each side and `continue`s.

### 5. Migration: the live trigger

The DB trigger is the authoritative standings writer for inserts, so it needed the same treatment: `supabase/migrations/107_absence_carryover_standings.sql` patches `public.update_standings_after_result()` **in place** via `pg_get_functiondef` + `replace()` (idempotent guards so a re-run is a no-op) and was applied with `npm run db -- supabase/migrations/107_absence_carryover_standings.sql`.

Patched behaviour, verified by rollback-style `RAISE EXCEPTION` probes:

- the absence test now reads `NEW.abandoned_type = 'home' OR (NEW.abandoned_type IS NULL AND NEW.home_score = 0 AND NEW.away_score = 3)` (and the mirrored away case);
- `away_gf := NEW.away_score; away_ga := 0;` / `home_gf := NEW.home_score; home_ga := 0;` instead of the hard-coded 3.

Probe results: home-absent `0-3` → home played+1, absent+1, `gd_penalty -3`, away wins +3 GF; home-absent `5-3` → away credited 3, home still absent; away-absent `8-5` → home `goals_for += 8`, away absent `-3`. Matches the lib expectations.

### 6. Resubmission clears a stale forfeit

Every rewrite path voids the balance the fixture itself created before writing the new score, using `voidBalancesCreatedBy()` from `lib/forfeit-balance-revert.ts` (this is what makes the user's second request work — see also `.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md` and `.opencode/context/forfeit-balances/admin-reset-voids-created-balances_2026-10-20.md`):

- the void un-applies the balance from any **later** fixture that already consumed it (trimming scores + stripping `forfeit_note:` lines);
- `results` UPDATEs re-fire the trigger which only adds NEW deltas, so every writer follows the void with `recalculateStandings()` for each affected extra tournament;
- writers always write `abandoned_type` (null when not a forfeit) and `override_reason`, so a correction that drops the forfeit leaves no half-forfeit row behind.

`clearAutoForfeitResults()` in `lib/slot-utils.ts` also re-opens consumed balances before deleting auto results, since auto-forfeits can now consume them.

### 7. UI: no double-counting

`components/ui/ForfeitBalanceBadge.tsx` gained an `autoApplied?: boolean` prop that disables the manual "Use" button and shows "Applied automatically to this absence result." `app/(admin)/admin/results/submit/ResultSubmitClient.tsx` passes `autoApplied={homeAbsent || awayAbsent}` and early-returns from `handleUseForfeitBalance`. The server side of that is `excludeBalanceIds: used_forfeit_balance_ids` in the admin finalise route.

## Review note (not changed)

`app/api/cron/flip-pending/route.ts` releases future-dated results by flipping them to `confirmed` and then rebuilding standings from all results (`recalculateStandings`), so a deferred result still lands in the table after the flip — the `confirmed_pending` guard in the trigger is covered. No patch needed there.

Pre-existing, out of scope: `updateLeagueStandings()` in `app/api/admin/finalise-result/route.ts` calls `db.rpc('update_standings_atomic', …)` without `p_participant_id` (which has no default), so the call errors and is swallowed. The DB trigger remains authoritative.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint` on all changed files: only pre-existing warnings.
- Trigger inspected after the migration: `absent_marker_patched`, `away_actual`, `home_actual` all true.
- Absence probes (home-absent 0-3, home-absent 5-3, away-absent 8-5) matched the lib expectations.
