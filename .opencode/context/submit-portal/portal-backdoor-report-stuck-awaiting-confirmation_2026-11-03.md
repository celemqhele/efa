# A settled match no longer sticks at "awaiting confirmation" after a not-responding report (2026-11-03)

Stopped `fixtures.status` being flipped to `awaiting_confirmation` when a manager files an
"opponent not responding" report on a match that already has a settle-on-file score, and made the
02:00 auto-finalise job actually resolve those late claims. The reported game (Gomora United 0-0
Hope, match day 2026-10-29) had been showing as not confirmed for four days after its report was
filed; the root cause was two defects stacking: the portal used the fixture status as an "under
review" flag, and the cron's late-claim query was silently truncated by the Supabase 1000-row
response cap, so the claim was never resolved.

## Problem

Reported: "every time after a postponed game gets confirmed it gets stuck at awaiting confirmation
instead of submitted. there is a game from 29 october that says not confirmed. its way past the 24
grace period and its still not confirmed."

What the data showed:

- Fixture `f6a29a4b-9bca-4ade-ac3e-b5e292fd8cc6` — **Gomora United 0-0 Hope**, match day
  `2026-10-29`. It was auto-finalised 0-0 ("Both teams absent — result void") by the 02:00 cron on
  30 Oct, then a manager filed a not-responding report from the `/submit-match/[code]` portal at
  `2026-10-30T10:20:58Z`.
- `submitBackdoor` (`app/api/submit-match/route.ts`) reacted by writing
  `fixtures.status = 'awaiting_confirmation'` as an "Under review" marker. That status is what the
  admin dashboard's **Fixtures Due** strip, the fixtures tables and the portal pill render as
  "awaiting confirmation" — so a game with a score already on file started reading as unsubmitted.
- The claim then stayed `pending` for days. The 02:00 job never resolved it, because pass 2 fetched
  **every** `confirmed`/`awaiting_confirmation` fixture older than the cutoff and filtered for
  pending claims in JS. 2015 fixtures match that filter while the Supabase/PostgREST response is
  capped at 1000 rows — verified with a probe: `exact matching rows: 2015`, `rows actually
  returned: 1000`, and the 29 Oct fixture was **not** in the returned page. Its claim was therefore
  invisible to the pass that is supposed to approve/void it.
- Nothing restores `confirmed` when a claim is declined, cancelled or expires either: the admin
  decline (`BackdoorSubmissionsClient.tsx`) and the portal cancel only update
  `backdoor_submissions.status`, so once flipped the fixture could sit at
  `awaiting_confirmation` forever. (The admin **approve** route does force `confirmed` —
  `app/api/admin/backdoor/approve/route.ts`.)
- The stale fixture was finally settled by hand today (admin `finalise_result` at
  `2026-11-03T10:46Z`), which is why the DB currently has no `awaiting_confirmation` rows: the
  remaining problem is the recurring mechanism, not one stuck row.

## Fix

### `app/api/submit-match/route.ts` — `submitBackdoor`

Removed the `fixtures.status = 'awaiting_confirmation'` write entirely. The report row itself is the
"Under review" marker (portal panel + admin backdoor queue + notification); the fixture keeps the
status its result already earned. The placeholder score still stays in the table until the 02:00 job
approves the claim or a real result replaces it.

### `app/api/cron/auto-finalise-prev-day/route.ts`

- **Pass 2 is now driven by open claims instead of every settled fixture**: it first reads
  `backdoor_submissions` rows with `status='pending'`, then fetches only those fixtures
  (`.in('id', pendingClaimFixtureIds)`) with the same due/status filters. This cannot be truncated
  by the row cap and is much cheaper than loading the whole fixture history. Approve/void logic is
  unchanged (real result on file → `void_game_played`; rule-decided fixture → approve the claim only;
  otherwise `autoApprove`, including the both-absent 0-0 placeholder the claim should overturn).
- **New pass 3 heals fixtures already stuck at `awaiting_confirmation`**: any due fixture in that
  status that has a result on file and **no** claim left `pending` is set back to `confirmed`. This
  covers legacy rows flipped before this fix and any decline/cancel/expire path that runs outside
  the app (e.g. the admin backdoor page and the WhatsApp admin flow). New stat:
  `stuckAwaitingHealed`.

## Verification

- `npx tsc --noEmit` clean; `npx next lint` on both touched files clean.
- Reproduced the truncation with a throwaway probe against production (read-only):
  2015 matching fixtures, 1000 returned, target fixture absent from the page.
- Exercised both new paths in-process via `npx tsx scripts/run-auto-finalise.ts`:
  - Temporarily set the live 3 Nov fixture `841c0604` (Hungry Lions vs Gomora United, one pending
    claim) to `awaiting_confirmation` and ran `... 2026-11-03 --dry` → `lateApproved: 1` with
    `approve -> 841c0604 ... 0-3`, proving pass 2 now sees claims outside the old row page. Status
    restored to `scheduled` afterwards.
  - Temporarily set `f6a29a4b` back to `awaiting_confirmation` and ran `--dry` → log line
    `awaiting_confirmation -> confirmed f6a29a4b…`, `stuckAwaitingHealed: 1`. Status restored to
    `confirmed`.
- Real run with no work left (`npx tsx scripts/run-auto-finalise.ts`) returned
  `processed 0, lateApproved 0, stuckAwaitingHealed 0, failed 0`.
- Post-run DB check: `select status, count(*) from fixtures group by status` → `confirmed 2015`,
  `scheduled 44`, i.e. no `awaiting_confirmation` and no `confirmed_pending` leftovers.

## Notes / deliberately not changed

- `awaiting_confirmation` still exists for its real meaning: both managers have submitted the same
  score and no result has been finalised yet (the `check_result_confirmations` trigger). Those rows
  have **no** result, so pass 3 never touches them; an admin still finalises them from
  `/admin/results/submit`.
- The 1000-row API cap applies to every unfiltered `select *` in this codebase — this fix only
  touches the query that was demonstrably losing rows. Worth a sweep if another "nothing ever
  resolves" report appears.
- No schema change, no new migration: the new queries are covered by
  `backdoor_submissions.status` and `fixtures.status` indexes already in place.

## Context chain (by path)

- The portal that files these reports and its status model:
  `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`
- Late claims on already-settled fixtures (pass 2's original contract):
  `.opencode/context/auto-finalise/pending-backdoors-resolved-every-02-00_2026-10-20.md`
- The 02:00 cutoffs / grace window this pass runs inside:
  `.opencode/context/auto-finalise/next-day-interim-0-0-and-catchup_2026-10-19.md` and
  `.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
- The earlier "still not confirmed" investigation for a postponed fixture (same wording, different
  cause: the `postponed_confirmed` flag):
  `.opencode/context/manager-stats/postponement-placeholder-tenure-spill_2026-10-26.md`

## Restore File Section

No tracked files were deleted. Two throwaway probes created during this investigation were moved
to the (gitignored) recycle folder per the repo deletion policy:

| Original Path | Description | Recycle Bin Path |
|---|---|---|
| `scripts/_tmp-probe-late-backdoors_2026-11-03.ts` | Ran the pass-2 fixture/claim embed shape against production to confirm it returns rows | `.recycle/scripts/_tmp-probe-late-backdoors_2026-11-03.ts` |
| `scripts/_tmp-probe-late-cap_2026-11-03.ts` | Compared exact-match count (2015) with returned rows (1000) and checked whether the 29 Oct fixture was in the page | `.recycle/scripts/_tmp-probe-late-cap_2026-11-03.ts` |
