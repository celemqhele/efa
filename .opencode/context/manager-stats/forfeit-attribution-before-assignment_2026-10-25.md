# Automatic forfeits no longer land on the manager who arrived afterwards (2026-10-25)

Stopped a manager from being charged with an automatic/backdoor 3-0 loss that was
stamped against their club before they were assigned. Manager ownership of a
result is now decided from the moment the result was recorded (`results.updated_at
?? results.created_at`) instead of from the fixture's date alone, in SQL (tenure
stats), on the match/result pages, and in the team-page manager states panel.
Follows the attribution design in
`.opencode/context/manager-stats/match-manager-attribution_2026-10-10.md` and the
forfeit semantics in
`.opencode/context/user-based-competitions/sack-keeps-club-managerless-forfeits_2026-09-30.md`.

## Problem

Reported: "if I sack someone today and they get a backdoor loss due to the
automatic rules, and I assign someone today a few hours later, that backdoor gets
attached to the manager who got assigned that day, making it seem like they got a
loss before they even played."

Root cause: everything that attributes a result to a manager used the fixture's
`scheduled_date` only, with **day** granularity:

- `recalc_tenure_stats()` (last version in
  `supabase/migrations/054_fix_manager_stats_trigger.sql`) counted every result on
  a fixture whose date fell inside `[started_at, ended_at]`.
- `trigger_recalc_on_result(_delete)` recalculated tenures that overlapped that
  date.
- `lib/match-manager.ts` picked the latest tenure that overlapped the match day.
- `lib/manager-stats-engine.ts` repeated the same date-window arithmetic in JS.
- `app/api/admin/sack/route.ts` calculated the sealed tenure's W/D/L itself.

A sack books 3-0 forfeits for the club's remaining fixtures (see
`forfeitUnmanagedClubSlots` in `lib/slot-utils.ts`). Forfeits for the sack day
confirm immediately; later-dated ones stay on file as `confirmed_pending`. A
replacement assigned hours later is inside the same match day as those forfeits,
so both the stored tenure row and the match page hero credited the loss to the new
manager.

Live reproduction at the time: Stellenbosch (`37b542ef-28fb-46fa-a827-e2444112af7c`)
was sacked 2026-10-22T20:55:21Z (12 forfeits booked), and `khwezii_10` was assigned
2026-10-25T13:12:58Z. Three surviving 3-0 forfeit losses (fixtures dated
2026-10-23/24/25 UTC, results created 2026-10-22T20:55:18–19Z) were shown against
`khwezii_10` — who had 0 wins, 0 losses and had never played.

## Fix

### 1. `results.updated_at` — "when was the current result decided"

`supabase/migrations/105_manager_attribution_at_result_time.sql` adds
`results.updated_at timestamptz default now()`, backfills it from `created_at`
(so history is not stamped with the migration time) and keeps it fresh with a
BEFORE INSERT OR UPDATE trigger (`touch_results_updated_at`). Replacing a forfeit
with a real score therefore counts as "decided now" instead of keeping the
forfeit's original timestamp.

### 2. Ownership rule in SQL

`recalc_tenure_stats(p_tenure_id)` now counts a result only when **all** of these
hold:

1. the tenure overlaps the fixture's calendar day (UTC): `started_at < day+1` and
   (`ended_at IS NULL` or `ended_at > day`). A same-day start or sack still counts.
2. the tenure started before the result was decided:
   `started_at < COALESCE(results.updated_at, results.created_at)`.
   Exception: a **human-entered** result (`results.finalised_by IS NOT NULL`)
   stamped before the fixture's own day is a pre-entry (backdoor/early
   submission), so match-day attribution alone decides. System results
   (`finalised_by IS NULL`: managerless/vacant forfeits, auto 0-0 placeholders)
   get no exception — they are exactly the ones that used to be back-dated onto a
   newcomer.
3. no later tenure also qualifies (`NOT EXISTS … started_at >` / id tie-break), so
   a fixture is never counted twice.

`trigger_recalc_on_result` / `trigger_recalc_on_result_delete` recalculate every
tenure overlapping the fixture's day (previously `<=` on dates, which skipped a
tenure that started mid-day); the ownership test inside `recalc_tenure_stats`
decides the winner.

The migration also adds `recalc_manager_stats(p_manager_id uuid default null)`
returning the number of tenures rebuilt, and ends with
`SELECT public.recalc_manager_stats(NULL)` to repair the stored numbers.

### 3. Sack paths seal the tenure before booking forfeits

Order matters: if the tenure is still open when the forfeits are inserted, its
window has no `ended_at`, so it would own every future-dated 3-0 as well. All sack
paths now close tenures **first**, then forfeit, then rebuild the sacked manager's
record:

- `lib/manager-mgmt.ts` — `sackManagerFromClub` (used by the WhatsApp flow and
  `replaceManagerOnClub`) and `promoteManagerToClub`.
- `app/api/admin/sack/route.ts` — the hand-rolled W/D/L block was deleted; it now
  closes tenures for every sibling club row and calls
  `recalculateManagerStats`, so the sealed row cannot disagree with the trigger.
- `app/api/admin/finalise-result/route.ts` — `checkAndAutoSack` (4 consecutive
  absences) reordered the same way.

Result: same-day forfeits stay with the manager who was in charge when the club
went unmanaged, later-dated ones belong to whoever owns the club then (usually
nobody until a replacement arrives), and the replacement starts clean.

### 4. Page attribution mirrors SQL

- `lib/match-manager.ts` — `resolveMatchManagers` accepts `decidedAt` and
  `systemResult` per side and applies the same rule (including the id tie-break),
  so the match/result hero agrees with the stored stats.
- `app/(public)/results/[id]/page.tsx`, `app/(public)/fixtures/[id]/page.tsx` —
  pass `result.updated_at ?? result.created_at` and `!result.finalised_by`.
- `app/(public)/teams/[id]/page.tsx` — the manager form/states panel skips system
  results stamped before the tenure began, so the newcomer's "team states" notes
  are not built from phantom forfeits.
- `lib/manager-stats-engine.ts` — `recalculateManagerStats` now just calls the
  `recalc_manager_stats` RPC (used by
  `app/api/admin/recalculate-manager-stats/route.ts`); the duplicated JS
  arithmetic is gone, so there is one source of truth.

## Verification

- Applied `npm run db -- supabase/migrations/105_manager_attribution_at_result_time.sql`
  (twice — the second run after the pre-entry carve-out was added; the file is
  idempotent) and recorded it with `npx tsx scripts/backfill-migration-history.ts`
  (1 inserted, total tracked = 104 → 105), following
  `.opencode/context/migration-history/104-extra-screenshot-urls_2026-10-20.md`.
- `results.updated_at` backfill: 1890 rows, 0 mismatched with `created_at`.
- Stellenbosch: `khwezii_10` now reads 0/0/0 (0 GF, 0 GA); `wandile`'s sealed
  tenure keeps 18/2/5. The three forfeits on 2026-10-23/24/25 are unowned, matching
  "the club had no manager on those days".
- Whole-league diff against the old date-only rule: 72 fixture sides change owner
  out of 3780 — 58 auto-flagged results (12 of them previously credited to the
  newcomer) and 16 same-day human results whose score came in before the handover
  (e.g. a result submitted 20:28Z staying with the manager who was in charge, not
  the one assigned 23:40Z). No pre-entered human result changed owner.
- `npx tsc --noEmit` clean; `npx eslint` clean on every touched file.

## Known limits

- Fixtures with **no result yet** still resolve to the latest tenure overlapping
  the match day (that is intended: an upcoming match belongs to the current
  manager).
- Auto 0-0 placeholders created by the 02:00 cron are system results stamped
  before their match day; if a manager is assigned after the placeholder but
  before the fixture day they will not own that 0-0. See
  `.opencode/context/auto-finalise/pending-backdoors-resolved-every-02-00_2026-10-20.md`.
- Standings are untouched: this only changes who a result is credited to, not the
  team-level table.

## Files

- `supabase/migrations/105_manager_attribution_at_result_time.sql` (new)
- `lib/match-manager.ts`
- `lib/manager-stats-engine.ts`
- `lib/manager-mgmt.ts`
- `app/api/admin/sack/route.ts`
- `app/api/admin/finalise-result/route.ts`
- `app/(public)/results/[id]/page.tsx`
- `app/(public)/fixtures/[id]/page.tsx`
- `app/(public)/teams/[id]/page.tsx`

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
