# Manager Stats Trigger Fix

## Problem
Manager tenure stats (wins, draws, losses, etc.) were not updating in real-time. Stored values were consistently 0/0/0/0 despite submitted matches.

## Root Cause
- The PostgreSQL trigger `on_result_for_manager_stats` (AFTER INSERT/UPDATE on `results`) fired alphabetically *before* the standings/fixture-status trigger (`on_result_insert`).
- The recalc logic filtered `f.status IN ('confirmed', ...)`.
- At trigger execution time, the fixture status was still `awaiting_confirmation`. The filter excluded the match → recompute result was 0/0/0/0. Since `results` existed, the trigger never re-fired.

## Fix
1. Migration `054_fix_manager_stats_trigger.sql`:
   - Removed the `f.status` filter from `recalc_tenure_stats` (a `results` row implies finalisation).
   - Added `AFTER DELETE` trigger handler to recompute tenure stats when results are voided/reset.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |

