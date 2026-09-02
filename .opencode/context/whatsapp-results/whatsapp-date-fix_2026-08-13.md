# WhatsApp Readable Dates

## Problem
WhatsApp fixture lists and confirm messages showed raw UTC ISO timestamps (e.g., `2026-08-14T22:00:00.000Z`) which were unreadable and conflicted with SAST dates on the admin dashboard.

## Fix
- Added `formatFixtureWhen(fixture)` helper that renders the SAST kickoff time consistently (e.g., "Tue 12 Aug · 02:00").
- Applied to all list formatters and confirm messages.

## Related files
- `formatFixtureWhen` is loosely related to the list formatter used in `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |

