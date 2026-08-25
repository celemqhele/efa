# UCL QF leg-1 score falsified — Barcelona progress 13–11, away-goals override reverted

Date: 2026-08-25
Chain: `knockout-generation/` (direct follow-up to
`qf-tiebreak-brugge-barcelona_2026-08-25.md` — read that first for the 12–12 tie-break ruling)

## What happened

The Club Brugge manager misrepresented the first-leg result. The recorded md 104 was
"Club Brugge 6–5 Barcelona", producing a 12–12 aggregate that the admin resolved via an
away-goals ruling in Brugge's favour. Later the admin learned **Barcelona actually won the
first leg 6–5** — i.e. the true leg-1 scoreline is **Club Brugge 5–6 Barcelona** (sides swapped).

With leg 2 unchanged (Barcelona 7–6), the real aggregate is **Barcelona 13–11** — no tie,
no tie-break needed. The entire away-goals override from the earlier incident is moot.

## Evidence trail

`notifications` for fixture `6763e997…` (md 104) showed two `result_confirmed` waves that
evening: "Club Brugge 5–4 Barcelona" at 21:31 UTC, then "Club Brugge 6–5 Barcelona" at
21:46 — a resubmission pattern consistent with the manager inflating the score. Leg 2's
"Barcelona 7–6 Club Brugge" (21:12) was never disputed.

## Data fixes applied (~10:12 UTC, 2026-08-25)

1. `results` row for md 104: `home_score` 6→**5**, `away_score` 5→**6**.
2. Bracket reverted to what `advanceWinner` would have produced with honest data:
   - md 202 away slot → **Barcelona**
   - md 212 mirror → **Barcelona vs Al Hilal**
3. `audit_log`: action `result_correction`, target fixture `6763e997…`, details documenting
   the misreport and reverts. (Earlier `manual_bracket_override` entry left in place as history.)
4. Notification cleanup:
   - 3 stale `result_confirmed` bodies corrected to "Club Brugge 5–6 Barcelona".
   - Al Hilal manager's match reminder rewritten (SF opponents are Barcelona again).
   - Club Brugge manager's SF reminder deleted (team eliminated, no fixtures today).
   - Equivalent reminder inserted for Barcelona's manager, who had received none while the
     slot was wrongly Brugge's.
   - Superseded "5–4" notifications deliberately kept as historical trail.

## Gotchas for next time

- A manual bracket override should be treated as provisional until both legs' scores are
  independently verified — one WhatsApp message reversed it within hours.
- When reverting a bracket override, remember the full blast radius: next-round slots,
  the leg-2 mirror (`matchday + 10`), audit trail, AND per-manager notifications
  (reminders name opponents explicitly).
- Notification bodies embed score text at send time; correcting a result does NOT update
  already-sent notifications — they must be patched/deleted by hand.
- Repeated `result_confirmed` notifications for the same fixture with drifting scores is a
  cheap falsification signal worth noticing early.

## Status

Final: **Barcelona progress to the UCL SF 13–11** vs Al Hilal (md 202 today, md 212 mirror).
Club Brugge eliminated. Away-goals rule still not implemented in code (see chain root file).

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
