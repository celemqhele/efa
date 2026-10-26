# Accepting a postponement now moves the fixture's deadline with the new date (2026-10-26)

When an opponent accepts a postponement, the fixture's `deadline` now moves to the new match day
(14:00 SAST, i.e. `<new date>T12:00:00Z`) instead of staying on the original day. Surfaced while
investigating the Highbury 3-0 Siwelele placeholder documented in
`.opencode/context/manager-stats/postponement-placeholder-tenure-spill_2026-10-26.md`: the fixture
had been moved from 2026-10-24 to 2026-10-25 but its deadline was still `2026-10-24T12:00:00Z`.

## Problem

`postponeRespond` in `app/api/submit-match/route.ts` updated `status`, `postponed_confirmed`,
`is_postponed`, `postponed_from` and `scheduled_date` on acceptance, but left `deadline` untouched.
Every other fixture-creating/scheduling path sets `deadline = <scheduled_date>T12:00:00Z`
(`lib/fixture-generator.ts`, `lib/phase-fixture-generator.ts`, `app/api/admin/schedule-fixtures/route.ts`,
`app/api/admin/batch-postpone/route.ts`).

Consequences:

- Reminder/status copy and the `deadlineBlock()` gate used the old day, so a moved fixture could read
  as "past its deadline" while it still had a day to play, or the opposite for early moves.
- Once the 02:00 cron clears `postponed_confirmed`, `buildState()`'s "settled result is final past the
  deadline" branch (`app/api/submit-match/route.ts`, `lib/submit-match.ts`) compares against that
  stale deadline. For a fixture moved *forward* this locks the placeholder early (from the old
  deadline), which is what the settled Highbury/Siwelele fixture would have exposed.

## Fix

`app/api/submit-match/route.ts` — the acceptance update now also writes:

```ts
// The deadline travels with the moved match day (14:00 SAST), like every
// other fixture. ...
deadline: `${newDate}T12:00:00Z`,
```

`newDate` is the validated `YYYY-MM-DD` from `postpone_requests.new_date` (same value already used
for `scheduled_date`), so the deadline format matches the other writers exactly.

## Verification

- `npx tsc --noEmit` passes.
- The already-settled `48421bed` fixture keeps its historical deadline
  (`2026-10-24T12:00:00Z`); it was finalised deliberately, so no retro-update was made. New
  postponement acceptances after this change carry the moved deadline.

## Restore File Section

No files deleted or moved for this change.
