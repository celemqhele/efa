# Export: Filter group standings by match date

Added a filter so that when exporting standings for group tournaments (UCL, Europa, etc.), only groups where at least one team played on the selected date are included. League tables remain unfiltered (full table always shown).

## Problem

When exporting standings for a specific date, all groups were shown even if only some had matches that day. This produced unnecessary images.

## Fix

In `app/(admin)/admin/export/page.tsx` (the `cardType === 'standings'` block, ~line 398):

- After `buildLiveStandings` returns `groupStandings`, query fixtures for the selected date to get the set of team IDs that played.
- Filter `groupStandings` to only keep groups where at least one team's `team_id` is in the playing set.
- League standings (`tournament.type === 'league'`) are left untouched — full table always shown.

One extra cheap Supabase query (fixtures by date) per tournament. No changes to `lib/standings-core.ts`.
