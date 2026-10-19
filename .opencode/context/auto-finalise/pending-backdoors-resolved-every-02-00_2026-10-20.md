# Pending backdoors are resolved every 02:00, whenever they were filed

The 02:00 auto-finalise cron now resolves **every** pending backdoor claim on a
match that is due, in a second pass that also looks at fixtures which are no
longer `scheduled` (already auto-finalised 0-0, automatic "club absent" 3-0, or
newly `awaiting_confirmation`). A late claim is accepted by the portal instead of
being refused as "past the deadline", flips the fixture to Under review, and the
next 02:00 run approves it.

Follow-up to `.opencode/context/auto-finalise/next-day-interim-0-0-and-catchup_2026-10-19.md`
(the cutoff change that made a match become a confirmed 0-0 the morning after)
and to `.opencode/context/submit-portal/portal-backdoor-status-and-disputes_2026-10-08.md`
(the backdoor panel). After those, the admin reported: "auto finalise and approve
backdoors every 02:00 if there are any no matter wheren they were submitted. i
get backdoor then i have to manually approve... so if its 15:00 so 15 hours after
deadline. the next day at 02:00 it will auto approve. same with postpone. if the
match becomes 0-0 or 3-0 due to backdoor and they postpone after deadline. score
will remain that backdoor until they play."

## Problem

1. **Pass 1 only ever looked at `status = 'scheduled'` fixtures with no result.**
   Once the cron (or an admin) had settled a match - the both-absent 0-0
   placeholder, an automatic 3-0 for a managerless club, or an agreed
   postponement - a claim filed afterwards had nothing left to pick it up and sat
   `pending` forever. Three live examples: Gomora United vs Hope and University
   of Pretoria vs Casric Stars (both on `confirmed` automatic 3-0s) and
   University of Pretoria vs Ben 10 (a real "postponement agreed" result).
2. **The portal refused the late claim before it could ever reach the cron.**
   `submitBackdoor` rejected anything where `deadlineBlock(dateKey)` fired or
   where `fixture.status` was not `scheduled` / `awaiting_confirmation`, and
   `buildState` set the same `backdoorBlock`, so the form was disabled too.
3. **A postponement could overwrite a backdoor result.** Accepting a postpone
   wrote a locked 3-0 for the acceptor with
   `override_reason: 'postponement agreed'`, replacing the backdoor 0-0 or 3-0
   that the match had already been decided by.

## Fix

- **`app/api/cron/auto-finalise-prev-day/route.ts`, new Pass 2** (runs after
  Pass 1, before the standings recalc). It loads every fixture with
  `scheduled_date <= finaliseCutoff`, `status in ('confirmed','awaiting_confirmation')`,
  not `postponed_confirmed`, no fresh pending postpone request, and resolves each
  pending claim:
    - **real result on file** (`finalised_by` or `screenshot_url`) -> the claim is
      superseded, so it becomes `void_game_played` (`staleClaimsVoided`),
    - **decided by rule** (either side has no manager, or the reason is an
      "absent" 3-0 that is not "both absent") -> the claim is marked `approved`
      but the result is NOT rewritten, because the standings trigger reads those
      reason strings as absence flags,
    - **everything else** (no result, or a "Both teams absent" 0-0 placeholder)
      -> `autoApprove()`, which writes the claim outcome (3-0 to the claimant,
      0-0 if both claimed), applies carry-over balances, advances knockouts and
      recalculates standings (`lateApproved`).
  `autoApprove()` now also **always** writes `override_reason` (null when there
  are no carry-over notes). It previously omitted the column, which meant a late
  claim replacing the "Both teams absent" 0-0 kept that reason and the trigger
  went on scoring the new 3-0 as a 0-0 double absence. It also clears the
  placeholder's `result_confirmations` row before inserting its own.
- **Late claims are accepted** (`lib/submit-match.ts`, `submitBackdoor`):
  `backdoorBlock` now only fires for a non-manager, a postponed-to-future match,
  or a fixture that already has a **real** result. `deadlineBlock` no longer
  closes reports, and the status gate accepts
  `scheduled` / `awaiting_confirmation` / `confirmed`. A claim filed against a
  placeholder result flips the fixture to `awaiting_confirmation` (the portal
  shows "Under review") while the placeholder score stays in the table until the
  02:00 approval.
- **Postponing keeps the backdoor score** (`app/api/submit-match/route.ts`,
  accept-postpone): if the fixture already has a non-real placeholder result, its
  scores and `override_reason` are carried into the postponement instead of
  writing the acceptor's 3-0, so a backdoor-decided match stays 0-0 / 3-0 until
  it is actually played on the new date. Postponed fixtures are also excluded
  from Pass 2 so the score is not touched before the replay.
- **Admin postpone accepts a placeholder** (`app/api/admin/postpone-fixture/route.ts`):
  the guard used to refuse every `confirmed` fixture ("Cannot postpone a finished
  fixture"), which made the admin's own scenario impossible after a backdoor had
  been approved. It now refuses `completed` / `abandoned` outright, and a
  `confirmed` fixture only when its result is real (`finalised_by` or
  `screenshot_url`). A placeholder-only `confirmed` match can be moved, keeps its
  0-0 / 3-0 in the table (`is_postponed` is display metadata and does not affect
  standings), and Pass 1 cannot re-finalise it because its status is no longer
  `scheduled`.

## Result

Dry run against production (in-process, `?dryRun=1`):
`processed 6, approved 6, lateApproved 2, staleClaimsVoided 1` - the two
automatic-3-0 fixtures took the by-rule branch, the "postponement agreed" claim
was voided, and the six scheduled fixtures were approved by Pass 1. Cron schedule
is unchanged (`0 0 * * *` UTC = 02:00 SAST in `vercel.json`).
