# ⚠️ IMPORTANT — Submit Result Page "No fixtures found" Fix

> **IMPORTANT:** This is a **known, recurring foot-gun**. The `/admin/results/submit` page
> must NEVER fetch fixtures with an unbounded query. Supabase/PostgREST silently caps
> responses at **1,000 rows** (no error), so any unbounded `select` on `fixtures` truncates
> data and the UI shows empty lists without warning.

## Problem
After fixtures were rescheduled/spaced out (balanced scheduler + bulk postponement), the
"Sched." tab on `/admin/results/submit` showed **"No fixtures found"**, while
`/admin/dashboard` correctly listed the due fixtures.

## Root Cause
- The submit page fetched **all** non-abandoned fixtures (`status != 'abandoned'`, no limit)
  ordered by `scheduled_date ASC` (`app/(admin)/admin/results/submit/page.tsx`).
- The table had 1,285 fixtures. PostgREST capped the response at the **1,000 oldest** rows —
  all `confirmed` (dates ≤ 2026-07-31).
- The 71 `scheduled` fixtures (dated 13–18 Aug — exactly the respaced ones) fell at rows
  1,000+ and were silently dropped → the "Sched." filter had nothing to match.
- The dashboard was unaffected because it filters to `scheduled` + `scheduled_date <= now`
  (~41 rows, under the cap).
- The count crossed 1,000 because rescheduling added more fixtures AND pushed all pending
  matches to the newest dates — precisely where the cap cuts off.

## Fix
In `app/(admin)/admin/results/submit/page.tsx`, replaced the single unbounded query with two
bounded ones merged into `relevantFixtures`:

1. **Pending** — `status IN ('scheduled', 'awaiting_confirmation')`, order `scheduled_date ASC`.
   Only ~71 rows, never truncated. Feeds the "Sched." tab.
2. **Completed** — `status = 'confirmed'`, order `scheduled_date DESC`, `.limit(500)`.
   Feeds "Comp."/"All" tabs for corrections/resets.

## Guardrails (apply when touching fixture queries)
- **Never** run an unbounded `.select()` on `fixtures` (or any large table). Always add
  `.in('status', ...)` and/or `.limit(...)`.
- Default PostgREST cap is 1,000 rows — queries larger than that truncate **silently**.
- Prefer server-side status/date filters over client-side filtering of a giant list.
- Same pattern applies to `result_confirmations`, `teams`, etc. if their row counts grow.

## Related files
- The 1,000-row truncation was triggered by rescheduling after `.opencode/context/fixture-scheduling/balanced-scheduler_2026-08-13.md` and `.opencode/context/fixture-scheduling/bulk-postponement_2026-08-15.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
