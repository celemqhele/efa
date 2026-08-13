# Bulk Postponement

## Problem
Need to postpone fixtures from today (Aug 11/12) to tomorrow.

## Fix
- Used a bulk postponement script `scripts/postpone-today-to-tomorrow.ts` to:
  - Target 28 fixtures with `status='scheduled'`.
  - Update `scheduled_date` (+1 day).
  - Set `is_postponed=true` and `postponed_from`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |

