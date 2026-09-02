# Super Cup auto-gen bug fix + manual Season 3 creation

Date: 2026-08-26
Chain: `knockout-generation/` (follow-up to `auto-super-cup-generation_2026-08-25.md`)

## Problem

Super Cup was NOT auto-generated when Season 3 UCL + UEL finals were both confirmed.
Both finals completed with trophies awarded, but `checkAndCreateSuperCup` never created
the fixture. No audit_log entry existed for `auto_generate_super_cup`.

## Root cause (two bugs)

### 1. RLS on read queries

`checkAndCreateSuperCup` used the passed `db` parameter for all read queries
(tournaments, trophies, fixtures). When called from the webhook path, `db` is the
**user-level** Supabase client which may fail RLS on these tables — the function would
silently return early without creating anything.

### 2. FK violation on audit_log

The function used a zeroed UUID (`00000000-0000-0000-0000-000000000000`) for
`audit_log.admin_id`. The `audit_log` table has a foreign key constraint to `profiles.id`,
so this insert would always throw.

## Fix

File: `lib/tournament-progression.ts` (commit `7332f9f`)

- Moved `createAdminClient()` to the top of `checkAndCreateSuperCup` and used it for
  **all** queries (reads + writes), not just the inserts.
- Audit log now looks up a real admin profile ID instead of the zeroed UUID.

## Manual Season 3 super cup

Created via SQL since the auto-generation failed:

| Field | Value |
|-------|-------|
| Tournament ID | `22cf1094-3dbc-4b83-a345-32174bf4e880` |
| UCL winner (home) | `01c6d980-895e-4b03-a66b-7db481b3b8d2` |
| UEL winner (away) | `6b72a4ea-f2e3-4228-8e6b-afffd3e9d1cc` |
| Scheduled date | 2026-08-26 |
| Season | `fee4a878-9159-4fd7-999f-d1bc7821bf86` (Season 3) |

## Related files

- Fixes .opencode/context/knockout-generation/auto-super-cup-generation_2026-08-25.md
  (the two bugs that prevented auto-generation).
- Follow-up (auto-completion + `hasFixtures` guard):
  .opencode/context/knockout-generation/tournament-autocomplete-and-fixtures-guard_2026-08-26.md.
