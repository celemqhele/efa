# Assign TbhoTouch as USA manager + backdate tenure (30 Aug)

Follow-up to `.opencode/context/user-management/create-tbhotouch-user_2026-08-30.md`
(the same user). After creating the account, the user asked to make TbhoTouch
the USA manager and backdate his tenure so USA's manager stats apply to him.

## What was done

Ran `scripts/assign-usa-backdate-tenure.sql` which:

1. Set `teams.manager_id = <tbhotouch profile>` for the USA team
   (`7a77ac86-7deb-4be6-b50a-d60819ac07c9`). It had no manager at the time.
2. Inserted an open-ended `manager_tenures` row for USA with
   `started_at = 2026-08-28T20:00:00Z` (backdated to just before USA's two most
   recent confirmed matches in the active EFA International Cup tournament).
3. Called `recalc_tenure_stats(tenure_id)` so the two backdated matches count.

USA's two recent matches (EFA International Cup):
- 2026-08-28  USA 6-2 Germany (home win)
- 2026-08-29  Belgium 1-2 USA (away win)

Resulting tenure: **2W-0D-0L, 8 GF, 3 GA** (matches the two wins, aggregate 8-3).

## Why "2 matches ago"

USA's older matches (EFA World Cup 2026, June–July) already belong to
`tildedot`'s ended tenure (`8b7594db...`, 15 Jun – 2 Jul, 0W-1D-4L, 5-15) and
to `branco80ts` (`ed72873b...`, 15 Jun). Backdating to `2026-08-28` avoids
overlapping those and only credits the current tournament's two matches.

## Notes

- The tenure `started_at` must be `<=` the fixture `scheduled_date` for a match
  to count (see `recalc_tenure_stats` in migration `010_auto_manager_stats.sql`).
  `2026-08-28T20:00:00Z` is safely before the 22:00 UTC kickoff.
- The recalc trigger only fires on `results` INSERT/UPDATE, so after backdating
  an existing tenure the stats were recomputed once via `recalc_tenure_stats`.
- USA has no sibling club rows (`logo_league_folder`/`logo_team_slug` unique to
  itself), so only the single USA team was updated.

## Files
- `scripts/assign-usa-backdate-tenure.sql` — one-off SQL (kept alongside other
  one-off scripts in `scripts/`).
