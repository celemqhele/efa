# Agreed-postponement placeholders no longer roll onto a manager who arrived afterwards (2026-10-26)

Fixed the Highbury 3-0 Siwelele fixture being credited to Siwelele's brand-new manager
(`maskandi_mfana`) instead of the manager who was in charge when the postponement was agreed
(`Terrence`): tenure stats now count a match day in SAST (not a UTC-shifted window), and the
`postponement agreed` 3-0 placeholder is treated as a system result instead of a manager-authored
score. A follow-up problem after the 2026-10-25 fix in
`.opencode/context/manager-stats/forfeit-attribution-before-assignment_2026-10-25.md`: that fix
stopped *pre-assignment system results* (no `finalised_by`) from being charged to a newcomer, but a
postponement placeholder carries the acceptor's id in `finalised_by`, so it slipped through the same
"net". The same investigation also settled the lingering fixture (its `postponed_confirmed` flag
kept it on every due/upcoming list) and corrected the postponement deadline, documented in
`.opencode/context/submit-portal/postpone-moves-deadline_2026-10-26.md`.

## Problem

Reported: "the match Siwelele vs Highbury is still not confirmed from Siwelele previous manager
despite being more than 24 hours deadline. please investigate and fix and then make sure the result
doesn't spill into new manager tenure and make sure it doesn't happen again."

What the data showed:

- Fixture `48421bed-f03f-4d46-a48c-de2acb384444` (Betway Premiership, matchday 209),
  **Highbury 3-0 Siwelele**, `override_reason = 'postponement agreed'`,
  `scheduled_date = 2026-10-25` (moved from 2026-10-24), `is_postponed = true`,
  `postponed_confirmed = true`, `status = 'confirmed'`. The result row was written
  `2026-10-24T18:07:29.777Z` by the **acceptor's** id (Highbury manager
  `24692fff-e6a2-49fe-8ec5-c59c4e7e0ea9`).
- `postpone_requests` `03b0993e-0f2a-4d58-a78a-92d7d1b4b416`: requested by Siwelele's then
  manager **Terrence** (`a01ab5d3-9143-4f31-b588-32f5507e49b7`) at `2026-10-24T18:04:05Z`,
  accepted by Highbury at `2026-10-24T18:07:29Z`, new date `2026-10-25`.
- No real score was ever submitted: `result_confirmations` has **0 rows** for the fixture and the
  only `results` row is the placeholder. The moved day (25 Oct) passed with no game.
- Siwelele tenures: Terrence `227f38e2-bc68-41e7-9e79-2b3cf5f83bc9`
  `2026-09-27T18:14:32Z → 2026-10-25T21:43:50Z` (sacked 23:43 SAST on the match day);
  `maskandi_mfana` `de9e65cf-7ce8-4031-b148-a2a15fed2e50` started `2026-10-25T22:13:10Z`
  (00:13 SAST on the 26th, 30 minutes after Terrence's tenure ended).
- Tenure stats before the fix: `maskandi_mfana` **0W 0D 1L, 0 GF 3 GA** — a 3-0 loss for a match
  he was never in charge of — while Terrence's stored row also already carried the same 3-0
  (24-1-3, 134/51), i.e. the fixture was counted on **two** tenures.
- The flag also meant the fixture still showed as postponed/pending everywhere that reads
  `postponed_confirmed` (admin due strip, completed counts, public upcoming lists), which is what
  "still not confirmed" looked like to the admin. The 02:00 cron only drops the flag once the moved
  day is a full grace day behind (`today - (GRACE_DAYS + 1)`), so on the 26th it was still up.

## Root cause — two holes in migration 105

1. **The day window treated a SAST date as UTC midnight.** `fixtures.scheduled_date` is a plain
   `DATE` holding the matchday managers see (it rolls over at SAST midnight). `recalc_tenure_stats`
   built the overlap window with
   `(scheduled_date::timestamp AT TIME ZONE 'UTC')` … `((scheduled_date + 1)::timestamp AT TIME ZONE 'UTC')`,
   i.e. `[00:00Z, 24:00Z)` of that date = **02:00 SAST → 02:00 SAST next day**. Anyone appointed in
   the first two hours of the following SAST day counted as overlapping the previous match day.
   maskandi started 00:13 SAST on 26 Oct and was therefore inside the 25 Oct window.
   (`lib/app-time.ts` already documents that matchdays are SAST; SQL ignored it.)
2. **`finalised_by` was used as "a human played this".** The carve-out for a result recorded before
   the fixture's day keyed only on `r.finalised_by IS NOT NULL`. The postponement placeholder is
   stamped with the **acceptor's** id (`app/api/submit-match/route.ts`), so it looked like a real
   pre-entered score: the match-day overlap alone decided, and the newcomer got it. It is a system
   placeholder — the 3-0 is booked by the system when the request is accepted, not played by anyone.

## Fix

- `supabase/migrations/106_tenure_attribution_sast_match_day.sql` (applied with `npm run db`, then
  tracked via `npx tsx scripts/backfill-migration-history.ts` → version 106 inserted, total
  tracked 105):
  - `recalc_tenure_stats()` rebuilds the overlap window with
    `AT TIME ZONE 'Africa/Johannesburg'` (SAST = UTC+2 year-round), so a match day runs
    `[22:00Z previous day, 22:00Z)`.
  - The pre-entry carve-out now requires
    `COALESCE(r.override_reason, '') <> 'postponement agreed'`, in both the tenure test and the
    `NOT EXISTS (later tenure)` test.
  - `trigger_recalc_on_result()` / `trigger_recalc_on_result_delete()` use the same SAST window when
    picking which tenures to recalculate.
  - Ends with `SELECT public.recalc_manager_stats(NULL);` so every stored tenure is rebuilt.
- `lib/match-manager.ts` mirrors the rule for the UI:
  - `dayStart = Date.parse('<dateKey>T00:00:00.000Z') - 2h` (SAST midnight), same `dayEnd`.
  - new exported `isPostponementPlaceholder(result)` (override_reason === 'postponement agreed') and
    `isSystemResult(result)` (`!finalised_by || isPostponementPlaceholder`).
- `app/(public)/fixtures/[id]/page.tsx`, `app/(public)/results/[id]/page.tsx`: `systemResult` now
  comes from `isSystemResult(result)` so the hero agrees with the SQL.
- `app/(public)/teams/[id]/page.tsx`: manager form/states list now (a) filters the same
  `systemResult`/`decidedAt` rule, (b) selects `override_reason`, and (c) compares `scheduled_date`
  to SAST day keys (`getSastDateKey`) instead of passing a timestamptz into a `DATE` comparison.
- One-off settle of the live fixture: `scripts/settle-highbury-siwelele-2026-10-26.sql` sets
  `postponed_confirmed = false` for `48421bed` (moved day passed, no real result, placeholder is
  final) and writes `audit_log` action `settle_postponed_fixture` with the attribution note.
  `status` stays `confirmed`; standings were already counting it once.

## Verification

- Attribution diff (old vs new rule, whole DB): 8 fixture-sides changed owner, 9 tenure rows
  recalculated.
  - `48421bed` Highbury 3-0 Siwelele (postponement agreed): `maskandi_mfana` → **Terrence** (the
    reported bug).
  - `cb183b1b` Orlando Pirates 4-4 Midlands Wanderers (2026-10-25, `postponement placeholder
    replaced`, result submitted 26 Oct by mjitta): `mjitta` → **ourfather_22**. Intended: the match
    day belongs to the manager in charge for it; mjitta was appointed 00:05 SAST on the 26th, after
    the 25 Oct day closed.
  - `f21296d8` Milford 3-0 Durban City (2026-10-13, automatic managerless 3-0 stamped
    `2026-10-12T22:47:16Z`): nobody → **jobe** (his tenure ended `22:47:11Z`, five seconds earlier;
    same-day sack forfeits deliberately stay with the sacked manager).
  - `4905496a`/`3ab0098c` Al Khaleej vs Real Betis / No Name (2026-08-16):
    `andile_vg` → **maninblack**, `dot` → **whitey**. Both newcomers were in fact appointed after
    00:00 SAST on the 17th, so the old UTC window had charged them for a match played on the 16th.
  - `bb83ac4b` Como 3-0 Man United (2026-08-05) and `144f3df9` Bournemouth 3-0 Man United
    (2026-08-04): `nkosithegreat` → **nobody**. His tenure started `2026-08-04T22:14:30Z` and the
    4 Aug result was stamped `2026-08-04T22:11:18Z` — three minutes before he existed.
- Post-fix Siwelele: Terrence `24W 1D 3L, 134/51` (keeps the 3-0), `maskandi_mfana`
  `0W 0D 0L, 0/0`. Standings unchanged (both clubs 28 played; Siwelele 3 losses, Highbury 22-1-5).
- Fixture now `status='confirmed'`, `postponed_confirmed=false`, `is_postponed=true` (keeps the
  "postponed from" context), audit row `settle_postponed_fixture` present.
- JS/SQL parity checked with a throwaway script: `resolveMatchManagers` returns **Terrence** for the
  Siwelele side of `48421bed` and **NO MANAGER** for Man United on `144f3df9`, matching the SQL
  ownership. `npx tsc --noEmit` passes.

## Prevention

- Both rules now live in one place per layer and are mirrored: SQL (`recalc_tenure_stats`) and
  TS (`lib/match-manager.ts` + `isSystemResult`). Any future placeholder written with a
  `finalised_by` (like the postponement 3-0) must be added to `isSystemResult` and the SQL
  carve-out so it can never be back-dated onto a newcomer.
- A postponement placeholder is only ever owned by a tenure that existed when it was stamped; a
  manager appointed on the moved day (or in the two hours after SAST midnight) can no longer inherit
  the agreed 3-0.

## Data changes (for the admin's awareness)

| Fixture | Match day | Result | Owner before | Owner after |
|---|---|---|---|---|
| Highbury vs Siwelele | 2026-10-25 | 3-0 (postponement agreed) | maskandi_mfana | Terrence |
| Orlando Pirates vs Midlands Wanderers | 2026-10-25 | 4-4 (placeholder replaced) | mjitta | ourfather_22 |
| Milford vs Durban City | 2026-10-13 | 3-0 (managerless absent) | — | jobe |
| Al Khaleej vs Real Betis / No Name | 2026-08-16 | 0-3 / 3-0 | andile_vg, dot | maninblack, whitey |
| Como 1907 vs Man United | 2026-08-05 | 3-0 | nkosithegreat | — |
| Bournemouth vs Man United | 2026-08-04 | 3-0 | nkosithegreat | — |

## Restore File Section

No files deleted. Scratch investigation files were moved out of `scripts/` into `.recycle/`:

| Original Path | Description | Recycle Bin Path |
|---|---|---|
| `scripts/_tmp-attribution-check_2026-10-26.sql` | Per-fixture predicate dump for Siwelele's tenures | `.recycle/scripts/_tmp-attribution-check_2026-10-26.sql` |
| `scripts/_tmp-attribution-diff-probe.sql` | Old-vs-new ownership diff across all results | `.recycle/scripts/_tmp-attribution-diff-probe.sql` |
| `scripts/_tmp-attribution-diff-details.sql` | Result timestamps/`finalised_by` for the changed fixtures | `.recycle/scripts/_tmp-attribution-diff-details.sql` |
| `scripts/_tmp-attribution-tenures.sql` | Tenure intervals for the affected clubs | `.recycle/scripts/_tmp-attribution-tenures.sql` |
| `scripts/_tmp-tenure-stats-diff.sql` | Stored stats before/after (backup table vs live) | `.recycle/scripts/_tmp-tenure-stats-diff.sql` |
| `scripts/_tmp-verify-match-manager-2026-10-26.ts` | JS/SQL attribution parity check | `.recycle/scripts/_tmp-verify-match-manager-2026-10-26.ts` |

The temporary SQL backup table `public._tmp_tenure_stats_backup_20261026` was dropped after the
diff.
