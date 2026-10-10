# Backdoor applications now apply carry-over forfeit balances (10 Oct)

Backdoor decisions — a manager's backdoor application approved by an admin, or
auto-approved by the daily cron — now absorb the same carry-over forfeit
balances a normally played match does. The user reported that backdoor
applications did not apply the forfeit balance at all, and asked for it to apply
to both backdoor outcomes: the single-claim **3-0** and the both-claims **0-0**.

## Problem
The played-match path (`app/api/submit-match/route.ts:216-259`, and the WhatsApp
`writeResultToDb` in `app/api/webhook/route.ts:6028-6084`) already adds every
remaining (`remaining > 0`) forfeit balance belonging to either fixture manager
to the correct side and consumes it (`remaining = 0`,
`consumed_by_fixture_id = <fixture>`). The backdoor writers did not — so a
backdoor result could sit next to an unconsumed balance for a manager who was in
that very fixture, and the carried-over score never landed.

Unlike a played match, a backdoor is a no-show decided by admin/cron review, so
nothing in the played-match code path ever ran for it.

## Decision (user)
Mirror the played-match behaviour exactly: apply **both** managers' balances. If
only one manager in the fixture has a balance, only that one is applied.

## Fix
- New helper `lib/forfeit-balance-apply.ts` — `applyCarryOverBalances(db, ctx,
  baseHomeScore, baseAwayScore)`:
  - Re-opens any balance this fixture already consumed
    (`remaining = 1, consumed_by_fixture_id = null where consumed_by_fixture_id =
    <fixture>`) so a resubmission/override re-counts it — same guard as
    `forfeit-balance-survives-resubmission_2026-10-10.md`.
  - Reads all remaining balances for both fixture managers, adds
    `forfeiting_score`/`opponent_score` to the correct side, consumes each
    (`remaining = 0, consumed_by_fixture_id = <fixture>`).
  - Returns the adjusted scores plus one `forfeit_note:<sourceFixtureId>:<sentence>`
    citation line per applied balance (the same format the public
    fixtures/results pages parse with `parseForfeitNotes()` in `lib/forfeit-note.ts`).
- `app/api/admin/backdoor/approve/route.ts` (admin approves a manager's
  application — single 3-0, both 0-0, or an upheld 3-0 dispute):
  - Fixture select now embeds `home_team`/`away_team` `(id, name, manager_id)`.
  - Calls `applyCarryOverBalances()` on the computed 3-0/0-0 base, uses the
    adjusted scores for the `results`/`result_confirmations` upserts and the
    returned response, and folds the citation lines into `override_reason`
    (keeping a leading `backdoor override` line when the fixture was already
    confirmed).
- `app/api/cron/auto-finalise-prev-day/route.ts` `autoApprove()` (stale
  applications auto-approved at 02:00 SAST): calls the helper **after** the
  `dryRun` early-return (so a dry run never mutates), feeds the adjusted scores
  into the result upsert and knockout `advances`, and sets `override_reason` to
  the citation lines when any balance applied. `finaliseZeroZero()` (no
  submission at all, a plain both-absent 0-0) is deliberately unchanged — it is
  not a backdoor application.

## Not changed
- The WhatsApp admin **override** tool `handleBackdoorSide`
  (`app/api/webhook/route.ts:1205-1311`, only ever writes 3-0) was left as-is: it
  is an admin override of an already-confirmed match, not a manager
  application. Can be extended the same way if wanted.

## Notes
- `npx tsc --noEmit` clean; `npx next lint` on the touched files shows only the
  two pre-existing unused-`e` catch warnings in the approve route.
- The standings engine (`lib/standings-engine.ts:364`) only tests
  `override_reason` for the substrings `absent`/`both`, so these
  `forfeit_note:` lines do not change how standings treat the result.

## Related
- `.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md` — the re-open guard reused here.
- `.opencode/context/forfeit-balances/admin-reset-reinstates-forfeit-balances_2026-10-10.md` — reset also re-opens consumed balances.
- `.opencode/context/submit-portal/forfeit-notes-cite-all-applied_2026-10-10.md` — the `forfeit_note:` multi-line citation format.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| (none) | All changes were edits plus one new helper | N/A |
