# Forfeit carry-over discards the forfeiter's own score

Corrected how a carry-over forfeit balance is applied to a later fixture result:
only the OPPONENT's (conceded) score is added to the opponent's side; the
forfeiting side's own score is discarded. So a forfeited **7-2** now starts the
aggregate at **7-0**, and if the carried fixture itself ends **2-2** the aggregate
becomes **9-2**, not 9-4. This is a follow-up to
`.opencode/context/forfeit-balances/backdoor-applies-forfeit-balances_2026-10-10.md`
(which introduced the shared apply helper) and
`.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md`;
the user reported the scoring rule after those landed.

## Problem

Every carry-over apply site added BOTH columns of the source balance to the new
result: `forfeiting_score` to the forfeiting side and `opponent_score` to the
opponent side. That double-weighted the forfeiter (their abandoned score carried
forward on top of the abandoned match's own recorded result), which is not the
intended rule. The intended rule is that only the score the forfeiter CONCEDED
carries over; their own score is void.

## Fix

Changed every apply site to add only `opponent_score` to the opponent side and add
nothing to the forfeiter:

- `lib/forfeit-balance-apply.ts` — the shared `applyCarryOverBalances()` helper used
  by the backdoor writers (`app/api/admin/backdoor/approve/route.ts` and
  `autoApprove()` in `app/api/cron/auto-finalise-prev-day/route.ts`). Removed the
  `forfScore` add; the `if (forfeitingIsHome) awayScore += oppScore else homeScore += oppScore`.
- `app/api/submit-match/route.ts` (~238-249) — the portal submit apply loop.
- `app/api/webhook/route.ts` (~6057-6068) — the WhatsApp `writeResultToDb` apply loop.
- `app/(admin)/admin/results/submit/ResultSubmitClient.tsx` —
  `handleUseForfeitBalance` client-side preview (`homeAdd`/`awayAdd` now place the
  full `opponentScore` on the opponent and 0 on the forfeiter; the note text no
  longer quotes a forfeiter `+score`).

The `forfeit_balances.forfeiting_score` column is retained: the note sentences
emitted on apply still cite the source match as `ended in <opponent_score>-<forfeiting_score>`
(historical record of what was forfeited), while the `became <home>-<away>` tail is
computed from the new rule and self-corrects. The 4 public views that render
`forfeit_note:` lines are unchanged. Restore/re-consume semantics are untouched
(see `forfeit-balance-survives-resubmission_2026-10-10.md` and
`admin-reset-reinstates-forfeit-balances_2026-10-10.md`).

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint` on the four changed files: no warnings/errors.

## Context chain (by path)

- Shared helper + backdoor apply: `.opencode/context/forfeit-balances/backdoor-applies-forfeit-balances_2026-10-10.md`
- Resubmission safety (re-open/consume): `.opencode/context/forfeit-balances/forfeit-balance-survives-resubmission_2026-10-10.md`
- Reset reinstates: `.opencode/context/forfeit-balances/admin-reset-reinstates-forfeit-balances_2026-10-10.md`

## Restore File Section
No repo files were deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
