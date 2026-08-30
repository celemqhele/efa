# Backdoor void-on-play — 30 Aug 2026

Closed a gap where a pending backdoor submission was left reviewable
(`pending`) after the real match result was already played, and fixed the
current stale Belgium vs USA submission to `void_game_played`.

This is a follow-up to `.opencode/context/backdoor/backdoor-approval-revert_2026-08-30.md`:
after that revert put Belgium vs USA's submission back to `pending`, the match
was then played for real (1-2, fixture `confirmed`) via the WhatsApp result path,
but the submission stayed `pending` and could still have been wrongly approved.

## Problem

Only `app/api/admin/finalise-result/route.ts` (lines 316-321) voided a fixture's
pending `backdoor_submissions` to `void_game_played` when a result was recorded.
The WhatsApp webhook result-submission path (`app/api/webhook/route.ts`, result
upsert → fixture `confirmed`, ~lines 3800-3900) set the fixture to `confirmed`
but did **not** void its pending backdoor submissions.

Result: a stale `pending` backdoor could sit on an already-played fixture and be
approved, which would overwrite the real result with a 3-0/forfeit. No DB trigger
exists on `backdoor_submissions`, so nothing auto-invalidated them.

Concrete affected case: fixture `965d33c3` Belgium vs USA — real result 1-2
(finalised 30 Aug 20:19 UTC via WhatsApp), submission `4fdf9d84` left `pending`.

## Fix

1. **WhatsApp result path** — `app/api/webhook/route.ts`: after the fixture is
   confirmed (on-time/backdated games only, `!isPending`), void that fixture's
   pending backdoor submissions:
   ```
   update backdoor_submissions set status='void_game_played'
   where fixture_id=... and status='pending'
   ```
   Mirrors `finalise-result/route.ts`. Future-dated (`confirmed_pending`) games
   are intentionally left alone.

2. **Approve route** — `app/api/admin/backdoor/approve/route.ts`: when approving
   a submission, also void any OTHER pending submissions for the same fixture
   (`.not('id','in',submissionIds)`), so a counterpart claim can't stay
   reviewable after the result is written.

3. **One-off script** — `scripts/void-backdoor-belgium-usa-30aug.ts` (mirrors the
   `scripts/revert-backdoor-approvals-30aug.ts` pattern): voided the stale Belgium
   vs USA submission `4fdf9d84` → `void_game_played`. Ran and verified: fixture
   `confirmed`, result 1-2 still present, 0 remaining pending, 1 voided.

## Notes / Gotchas

- No DB trigger on `backdoor_submissions`; invalidation is application-level in
  the result-writing routes.
- The validate-on-approve / `isOverride` semantics in the approve route were left
  as-is; this fix only prevents orphaned *other* pending claims per fixture.
- The WhatsApp result path writes the fixture status now; the void was placed
  after the confirm block so it always runs for on-time games regardless of
  whether the trigger or the fallback confirmed the fixture.

## Related files

- Revert that set the stage:
  `.opencode/context/backdoor/backdoor-approval-revert_2026-08-30.md`
- Void-on-finalise that already existed:
  `app/api/admin/finalise-result/route.ts` (lines 316-321)
- One-off script: `scripts/void-backdoor-belgium-usa-30aug.ts`.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
