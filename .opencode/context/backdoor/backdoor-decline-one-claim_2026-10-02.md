# Backdoor Review: Declining One Claim Declined Both

Fixed the admin backdoor review page so a decision applies to the single claim it was made on, instead of every claim for the fixture. Follow-up to the backdoor review work in `.opencode/context/backdoor/backdoor-approval-revert_2026-08-30.md` and `.opencode/context/backdoor/backdoor-submissions-refresh-fix_2026-08-16.md`.

## Problem

The user declined the Home backdoor claim for **Gomora United vs Lerumo Lions** (2026-10-02) intending to then approve the Away claim. One click declined both, so the Away claim was no longer reviewable and the intended 3-0 could never be recorded.

The buttons are rendered **per submission row**, but both ignored the row they sat on:

```tsx
onClick={() => handleAction(fixtureId, submissions.map(s => s.id), 'decline')}
```

`submissions.map(s => s.id)` is the whole fixture's set. Proof from the live rows: both claims ended with the identical `reviewed_at = 2026-10-02T20:56:59.150Z`, the signature of a single `.in('id', [...])` update.

Two consequences, both from the same line:

1. **Decline hit every claim**, so declining one manager's claim destroyed the other manager's claim.
2. **Approve was worse, and silent.** `app/(admin)/admin/backdoor-submissions/page.tsx` loads *all* submissions for a fixture with **no status filter**, so `submissions` included already-reviewed rows. `/api/admin/backdoor/approve` branches on `submissions.length`: 2 claims → **0-0**, 1 claim → 3-0 to the opposite of `side_claimed`. Passing every row meant the `length === 1` branch was **unreachable from this page** — approving a single backdoor claim recorded a 0-0 draw instead of the correct forfeit.

## Fix

### `BackdoorSubmissionsClient.tsx`

- Row-level Approve and Decline now act on `[sub.id]` only.
- Busy state moved from `loadingFixtureId` to `busyKey` keyed on the submission, so only the clicked row shows "Declining..." and a decline no longer dims the whole fixture.
- Added a fixture-level **"Approve both (0-0)"** button, shown only when 2+ claims are still `pending`. Per-row approve is what makes the 0-0 draw unreachable otherwise, so the draw path had to be given its own explicit control. It passes `pendingIds` only — never a stale reviewed row.
- The decline path checked nothing: `.update()` returns `{ error }` and does not throw, so a failed write looked like a success. Now the error is thrown and surfaced.

### `app/api/webhook/route.ts` — the same defect in the WhatsApp review flow

`handleBackdoorAdminDecision` applied `.in('id', submissionIds)` over every pending claim, so replying "decline" declined them all. Since the WhatsApp flow is the admin's primary interface, leaving it would have kept the bug live.

- Claims are now shown **numbered** and a reply resolves to the claims it covers: `"1 approve"` / `"2 decline"` for one claim, `"both approve"` / `"both decline"` for the whole match.
- A bare `approve`/`decline` now only applies when a **single** claim is pending. With two pending it re-prompts with the syntax instead of guessing, since that ambiguity is the bug itself.
- The score branch reads `side_claimed` from the resolved subset, so a one-claim decision yields the correct 3-0.
- Added the counterpart-void (`status: 'void_game_played'` for other pending claims) that `/api/admin/backdoor/approve` already had, so a one-claim approval no longer leaves the counterpart approvable.

## A trap avoided

The review UI renders `side_claimed === 'home' ? 'Away' : 'Home'`, which looks inverted. It is **not** a bug: `side_claimed` is the side of the team that **did not respond** (the submitter is prompted *"Type the team that's not responding"*, `resolveBackdoorSide`), so inverting it correctly shows the submitter's own side. Verified against the live rows — ozilotf_ (Gomora, home) stored `away`, dot (Lerumo, away) stored `home`, and the UI displayed both correctly. "Fixing" that label would have started showing the wrong team.

## Data repair for the reported fixture

The one click had left both claims `declined`, so the intended decision was applied via
`.recycle/tmp-repair-backdoor-lerumo_2026-10-02.ts`, which mirrors
`/api/admin/backdoor/approve` step for step using the same helpers rather than
hand-rolling writes. It aborts unless the fixture is `scheduled` with no existing result.

Result: 27697333125 (ozilotf_, Gomora home) `declined`, 27784831815 (dot, Lerumo away)
`approved`, fixture `confirmed` at **0-3**, standings recalculated. Confirmed in
`standings`: Lerumo GF 4, Gomora GA 8, both played 5 — consistent with the 0-3.

## Verification

- `npx tsc --noEmit` clean; eslint 0 errors on both files (all warnings pre-existing); `next build` succeeds.
- `.recycle/tmp-verify-backdoor-decision_2026-10-02.ts` replays the resolution matrix against the real claim data: `"1 decline"` touches exactly one claim, the counterpart stays pending, a bare `"decline"` with two pending re-prompts, and out-of-range numbers and garbage re-prompt. 12/12 cases pass.
- Score derivation checked per claim: approving ozilotf_ yields 3-0 home, approving dot yields 0-3, `"both approve"` yields 0-0.

## Restore File Section

- `scripts/tmp-verify-backdoor-decision.ts` — read-only replica of the decision-target
  resolution proving per-claim scoping. Moved to `.recycle/tmp-verify-backdoor-decision_2026-10-02.ts`.
- `scripts/tmp-repair-backdoor-lerumo.ts` — one-off repair of the Gomora vs Lerumo
  backdoor decision. Moved to `.recycle/tmp-repair-backdoor-lerumo_2026-10-02.ts`.