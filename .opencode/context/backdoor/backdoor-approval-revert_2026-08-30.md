# Backdoor approval revert — 30 Aug 2026

Reverted three EFA International Cup backdoor approvals made by the admin today:
submissions put back to `pending` and the fixtures returned to `scheduled`
(product asked for exactly this), via one-off script
`scripts/revert-backdoor-approvals-30aug.ts`.

## Problem

On 30 Aug 2026 the admin approved backdoor claims on the
`/admin/backdoor-submissions` review page. The approvals wrote results,
confirmed the fixtures, and the points are counted in standings — but the claims
were not meant to hold, and the product wanted the applications pending again so
the matches can be re-dealt.

Approved fixture batch (same admin `87d8afba`, EFA International Cup
`e2c61a3e-072e-4a07-8024-76de20c2a99a`):

| Fixture | Score after approve | Note |
|---------|--------------------|------|
| `965d33c3` Belgium vs USA | 0-3 | single submission (side_claimed home), approved 19:29 UTC |
| `cb7d5f66` Brazil vs Algeria | 3-0 | single submission (side_claimed away), approved 19:16 UTC |
| `5234a927` Egypt vs Norway | 3-0 | two submissions (both sides) approved 19:15 UTC → 0-0, then overwritten 19:17 via `app/api/admin/finalise-result/route.ts` to `override_reason='Norway absent — forfeit (3–0)'` |

## Fix

`scripts/revert-backdoor-approvals-30aug.ts` (mirrors the one-off pattern from
`scripts/fix-backdoor-side-inversion.ts`), per fixture:

1. Deleted orphaned `match_stats` (FK on `results`) then `results` rows.
2. Deleted `result_confirmations` written by the approvals.
3. `backdoor_submissions` → `status='pending'` (also cleared `reviewed_by` /
   `reviewed_at`) so the claims are reviewable again.
4. `fixtures.status` → `'scheduled'`.

Then `recalculateStandings` for the tournament (32 group rows rebuilt, 96
fixtures processed).

Verified: all three fixtures `scheduled`, no `results` row, submissions `pending`.

## Notes / Gotchas

- Neither approve path writes `audit_log`, and the finalise-result path only
  wrote one for Egypt-Norway — leftover audit history was intentionally left
  intact (history should not be erased).
- No `forfeit_balances` rows existed for these fixtures, so nothing to unwind
  on that front.
- `notifyBackdoorDecision` sent approval notifications to the managers — those
  were not retracted (admin-side revert only, as requested).
- All three are `round_type='group'`, so no knockout advancement
  (`advanceWinner`) needed unwinding.

## Related files

- Approval code the revert undoes:
  `app/api/admin/backdoor/approve/route.ts` and
  `app/api/webhook/route.ts` (`handleBackdoorAdminDecision`).
- Reused pattern from
  `.opencode/context/backdoor/backdoor-side-inversion_2026-08-16.md`.
- One-off script: `scripts/revert-backdoor-approvals-30aug.ts`.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |