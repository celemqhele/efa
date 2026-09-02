# Backdoor side_claimed inversion — root cause fix + data correction (16 Aug)

## Problem
Backdoor submissions made via WhatsApp kept awarding the **wrong team** the 3-0
win. Example: Al Hilal's manager reported Al Ettifaq as not responding in both
UCL legs, yet **Al Ettifaq** was recorded as winning 3-0 in both.

## Root Cause
The backdoor submission prompt asks the manager **"Who is not responding?"** and
stores that answer in `backdoor_submissions.side_claimed` — i.e. `side_claimed`
is the **absent/non-responding team (the loser)**. The 3-0 backdoor win belongs
to the **OPPOSITE** side (the reporting manager's team).

But both approval paths treated `side_claimed` as the WINNER and awarded the 3-0
to that side:

- Web review page — `app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx`
  (`handleAction`, single-submission branch).
- WhatsApp admin decision — `handleBackdoorAdminDecision` in
  `app/api/webhook/route.ts`.

So every approved single-submission backdoor gave the win to the absent team.
(The design intent is documented in `lib/backdoor-notify.ts`: *"the submitter
answers 'who is NOT responding' (side_claimed), so the reporter is always the
manager of the team OPPOSITE side_claimed."*)

## Affected fixtures (all fixed 16 Aug)
Approved single submissions, result was applied to the wrong (claimed) side:

| Fixture | Was (wrong) | Now (correct) | Competition |
|---------|-------------|---------------|-------------|
| `09248200` Al Ettifaq vs Al Hilal (MD9) | Al Ettifaq 3-0 | **Al Hilal 3-0** | UCL `7174e29f` |
| `035b51e8` Al Hilal vs Al Ettifaq (MD27) | Al Ettifaq 3-0 | **Al Hilal 3-0** | UCL |
| `c67764d7` Burnley vs Barcelona (MD24) | Barcelona 3-0 | **Burnley 3-0** | UCL |
| `0682a030` Barcelona vs Burnley (MD32) | Burnley 3-0 | **Barcelona 3-0** | UCL |
| `0766556f` Bayer Leverkusen vs Al Khaleej (MD4) | Al Khaleej 3-0 | **Leverkusen 3-0** | UEL `80e86b39` |

(Real Betis vs Real Madrid `353711d8` was the same bug — fixed separately in
`.opencode/context/backdoor/backdoor-betis-win_2026-08-16.md`.)

Note: the Burnley/Barcelona pair nets to the same overall record for both teams
(each fixture flipped, symmetric) but now matches the managers' claims.

## Data Fix
One-off script `scripts/fix-backdoor-side-inversion.ts` (re-run safe, override
path mirroring `handleBackdoorSide` with `isOverride`):
- Per fixture: inserts a `result_confirmations` row, upserts the result with
  `override_reason = 'backdoor override'`, keeps the fixture `confirmed`, voids
  pending `backdoor_submissions`, notifies both managers, writes an `audit_log`
  `finalise_result` entry (`home_absent`/`away_absent` = the claimed absent side).
- Then `recalculateStandings` for UCL (`7174e29f`) and UEL (`80e86b39`) —
  both group tournaments (16 + 10 group rows rebuilt).

Standings after fix: Al Hilal 5W 0D 1L (15 pts), Al Ettifaq 2W 0D 4L (6 pts),
Leverkusen 5W 1D 0L, Al Khaleej 2W 0D 2L.

## Code Fix (root cause)
- `BackdoorSubmissionsClient.tsx` — single-submission approve now scores 3-0 to
  the side **OPPOSITE** `side_claimed`; submitter label shows the reporting team
  (opposite), not the claimed side.
- `route.ts handleBackdoorAdminDecision` — same score flip (comment corrected).
- `route.ts handleBackdoorAdminReview` — "backdoor submitted by X" and
  "Submission by phone (Home/Away team)" labels now show the reporting side.
- `route.ts getTeamsForAssignment` — backdoor-loser team selection now uses
  `side_claimed` as the loser (was inverted).

## Notes / Gotchas
- `notifyBackdoorDecision` (reporter = opposite of `side_claimed`) and the
  submission prompt were already correct — only the approval/display/loser logic
  was inverted.
- Older `expired` submissions (Brighton/Como, 9-10 Aug) were applied by other
  paths / were real results, not this bug.
- `npx tsc --noEmit` passes; lint clean except pre-existing unused-var warnings.

## Related files
- `.opencode/context/backdoor/backdoor-betis-win_2026-08-16.md` — the same `side_claimed` bug surfaced there, fixed as a data-only correction (this file is the structural root-cause fix).
- Other changes to the same `BackdoorSubmissionsClient.tsx`:
  - `.opencode/context/backdoor/backdoor-admin-auth-fix_2026-08-15.md` — cookie-based auth fix.
  - `.opencode/context/backdoor/backdoor-submissions-refresh-fix_2026-08-16.md` — replaced dead `refreshKey` with `router.refresh()`.
  - `.opencode/context/knockout-generation/backdoor-dashboard-approve-progression_2026-08-24.md` — approve-path progression wiring.
- The `lib/backdoor-notify.ts` design intent (side_claimed = the absent side) is documented in `.opencode/context/notification-sounds/notifications-sounds_2026-08-15.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
