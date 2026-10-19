# Portal: "Did this player give you the win?" walkover question

Added a "Did this player give you the win?" yes/no question under the forfeit
question on the result form. Answering **Yes** locks the result to a flat 3-0
win for the submitter, greys out the score boxes whatever was typed, and greys
out the forfeit question, so an agreed walkover is recorded as a plain 3-0
instead of being entered as a forfeit (which would add +3 and start a carry-over
penalty).

Follow-up to `.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
(the portal submission forms) and to
`.opencode/context/forfeit-balances/admin-reset-voids-created-balances_2026-10-20.md`
(the forfeit-balance repair from the same session, which is exactly the
difference the admin wanted kept apart: a walkover is *not* a forfeit).

## Problem

The admin's rule: "below the forfeit question add 'did this player give you the
win?' default No. if yes the result should be fixed 3-0 to the one submitting
and grey out the score entry no matter what numbers were typed, and grey out the
forfeit question too."

Before this, the only way to record a no-show was the forfeit question, which
uses a different rule (`forfeit=yes` adds **+3 goals** to the typed score and
creates a carry-over balance with `opponent_score = winner's final score`). That
made "3-0 plus forfeit = 6-0" the accidental outcome in TS Galaxy vs Polokwane
City, and the penalty then leaked into the manager's next match. A walkover
where the opponent simply hands over the win is a flat 3-0 and must not carry a
penalty.

## Fix

- **UI** (`app/submit-match/[code]/_portal.tsx`, `ResultPanel`): new
  `givenWin` state (default `'no'`) rendered as a Yes/No pair under the forfeit
  question. When `Yes`:
    - the score inputs are `disabled` and show `shownHome` / `shownAway` forced to
      `3-0` for the viewer's side (`side` prop), so typed numbers are visibly
      overridden and greyed (`opacity-60`),
    - the forfeit radios are `disabled` with the hint "Not needed - a walkover is
      recorded as a flat 3-0.",
    - an accent-tinted note states the recorded result ("Recorded as 3-0
      walkover win to you. The score and forfeit controls stay locked."),
    - the form posts `givenWin` and `forfeit: 'no'`.
  Choosing No again restores whatever score was typed.
- **Server** (`app/api/submit-match/route.ts`, `submitResult`): `givenWin` is
  parsed before validation, so a walkover is accepted with empty score fields
  (`homeScoreRaw` / `awayScoreRaw` are coerced to 0 only after the
  `!givenWin` validation). The submitted score is then forced to 3-0 to the
  submitter's side with `override_reason: 'opponent gave the win (walkover 3-0)'`,
  and `givenWin=yes` together with `forfeit=yes` is rejected as contradictory.
  No `forfeit_balances` row is created, `is_abandoned` stays false.
- Knockout progression, the audit row and the notification now use
  `finalHomeScore` / `finalAwayScore` (the post-adjustment values) instead of the
  pre-adjustment scores, so a walkover advances the right team.

## Result

- "No" (default) leaves the form exactly as it was.
- "Yes" always records a flat 3-0 to the submitter, no matter what was typed, and
  cannot be combined with a forfeit.
