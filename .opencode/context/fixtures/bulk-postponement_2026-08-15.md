# Bulk Postponement

## Problem
Need to postpone fixtures from one date to another.

## Fix
- Reusable script `scripts/postpone-fixtures.ts`:
  - `scheduled_date` is a **DATE column storing the SAST calendar match day** (kickoffs are 02:00 SAST). Use `YYYY-MM-DD` for the SAST day, e.g. `2026-08-14`.
  - `npx tsx scripts/postpone-fixtures.ts 2026-08-14` postpones all `status='scheduled'` fixtures on that date by +1 day; supports `--days N`, `--to YYYY-MM-DD`, `--status`, `--dry-run`.
  - Updates `scheduled_date`, sets `is_postponed=true` and `postponed_from`, inserts `fixture_postponed` in-app notifications for both managers, and writes `audit_log` entries (`action='postpone_fixture'`, admin celemqhele).
- History:
  - `scripts/postpone-today-to-tomorrow.ts`: 28 fixtures, `status='scheduled'`, +1 day.
  - `scripts/postpone-14aug-to-15aug.ts`: 39 fixtures postponed from 2026-08-14 to 2026-08-15 (recycled, see below).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `scripts/postpone-14aug-to-15aug.ts` | One-off 14 Aug → 15 Aug postponement script (39 fixtures, ran 2026-08-15). Superseded by `scripts/postpone-fixtures.ts`. | `.recycle/postpone-14aug-to-15aug.ts` |

