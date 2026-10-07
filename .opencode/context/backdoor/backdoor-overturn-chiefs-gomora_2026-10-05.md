# Backdoor Overturn: Kaizer Chiefs vs Gomora United — 5 Oct 2026

Overturned the approved backdoor submission for Kaizer Chiefs vs Gomora United (submitted by phone `27697333125` / `ozilotf`, Away team manager), removing the recorded result, returning the fixture to `scheduled`, and declining the backdoor claim.

## Problem

The admin previously approved a backdoor claim for fixture `5932e368-8509-49ae-9033-f433343a3c51` (Kaizer Chiefs vs Gomora United) in the Motsepe Foundation Championship tournament (`5a267e10-0edd-42f0-8f04-b28ec40713f8`), which wrote a 0-3 result and confirmed the fixture. The user requested to overturn this backdoor and decline the claim instead.

## Fix

Created and executed the one-off script `scripts/overturn-chiefs-gomora-backdoor.ts` (reusing patterns from `.opencode/context/backdoor/backdoor-approval-revert_2026-08-30.md` and `.opencode/context/backdoor/backdoor-decline-one-claim_2026-10-02.md`):

1. Deleted orphaned `match_stats` then `results` rows for fixture `5932e368-8509-49ae-9033-f433343a3c51`.
2. Deleted `result_confirmations` for the fixture.
3. Updated `backdoor_submissions` row `81345270-78c9-4fdf-a653-de643511c917` to `status='declined'`.
4. Updated `fixtures.status` to `'scheduled'`.
5. Recalculated standings for tournament `5a267e10-0edd-42f0-8f04-b28ec40713f8`.

Verified: fixture status is `scheduled`, result row is removed, backdoor submission status is `declined`, and standings successfully recalculated.

## Related files

- One-off script: `scripts/overturn-chiefs-gomora-backdoor.ts`
- Previous backdoor revert pattern: `.opencode/context/backdoor/backdoor-approval-revert_2026-08-30.md`
- Previous backdoor review fix: `.opencode/context/backdoor/backdoor-decline-one-claim_2026-10-02.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
