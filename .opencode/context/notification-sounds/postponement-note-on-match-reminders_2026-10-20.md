# Postponement note on the match reminder messages

Every WhatsApp match reminder for a postponed game now ends with the note
"Please note this is a postponement game, Please play the game to avoid
penalties", so a manager cannot mistake the agreed score already sitting in the
standings for a finished match.

Follow-up to `.opencode/context/auto-finalise/pending-backdoors-resolved-every-02-00_2026-10-20.md`
(postponing keeps the agreed 0-0 / 3-0 in the table until the replay) and to
`.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
(the postponement flow itself). The reminder cron already sent reminders to these
fixtures, but the text read like any other unplayed match, so nothing told the
managers the game still had to be played.

## Problem

`lib/cron/notification-logic.ts` already included postponed-confirmed fixtures in
the reminder query (`.or('status.in.(scheduled,awaiting_confirmation),postponed_confirmed.eq.true')`),
because such a fixture carries status `confirmed` while still being unplayed on
its moved date. However the composed body was identical to an ordinary fixture, so
a manager whose match had been postponed was reminded to "play now to avoid an
automatic loss" with no indication that this was the replay.

Choosing the right marker mattered: `fixtures.is_postponed` cannot be used. The
normal result-submission path sets it too
(`app/api/submit-match/route.ts` writes `is_postponed: true` when a result is
saved), so it is true on almost every finished fixture. `postponed_confirmed` is
the reliable flag: it is only set on a postponed fixture whose agreed score is
already recorded and whose game is still to be played on the moved date.

## Fix

- `lib/cron/notification-logic.ts`:
    - `FixtureRow` gained `postponed_confirmed: boolean`, selected in the fixture
      query and mapped from the row (`f.postponed_confirmed === true`),
    - new `POSTPONEMENT_NOTE` constant holding the wording exactly as requested,
    - after the per-type `switch` that builds the body, the note is appended when
      any fixture in that manager's group is a postponement, so all four reminder
      types (morning, midday, afternoon, deadline) carry it without duplicating
      the string in each branch.
- Nothing sends twice and no extra notification rows are created: the note is
  added to the existing body of the existing reminder.

## Result

Verified by re-running the reminder query against production for the current
match day (20 Oct 2026): 12 fixtures were in scope and exactly one was a
postponement, `Wits Sport vs TUT FC` (`postponed_confirmed = true`, status
`confirmed`). All four composed bodies ended with the note, for example:

```text
You have 1 fixture today: Wits Sport vs TUT FC. Deadline: 14:00 SAST.

Please note this is a postponement game, Please play the game to avoid penalties
```

The other 11 fixtures were unaffected. Sends no reminders by itself; the live
crons pick this up on their normal schedule.
