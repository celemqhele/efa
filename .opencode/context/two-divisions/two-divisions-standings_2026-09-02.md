# Full 2-Division Season Support — Standings Zones, Two League Tournaments, Manual Cup Selection

Implemented full two-division season support for the EFA platform: every season now creates two `league` tournaments — Division 1 "EFA Premier League" and Division 2 "EFA Championship" — sharing one season row, with per-division zone-colored standings UI and fully manual cup (UCL/Europa) team selection. Underlying split decisions were confirmed with the user via the question tool (two separate `league` tournaments, not one tournament with divisions inside; zones Div 1 red/yellow vs Div 2 green/yellow; fully manual cup selection; EFL-style names; two team pickers with even-count validation).

## Problem

The platform supported only a single `league` tournament per season with a single hardcoded set of standings borders (UCL places `index < 12` → `border-l-accent`, Europa places `index < 20` → `border-l-blue-500`). The admin wanted two divisions of 16 teams each: Division 1 relegation/bottom-zone colours (positions 14, 15, 16 red; 12, 13 yellow) and Division 2 promotion-zone colours (top 3 green; 4, 5 yellow), plus manual pick of cup teams across both divisions instead of automatic top-N.

## Fix

### Data model
- Migration `supabase/migrations/070_add_tournament_division.sql`: adds `tournaments.division integer`, backfills existing league tournaments to `1`, adds index `tournaments_season_type_division_idx`. Applied via `npm run db` and verified. (As documented in `.opencode/context/migration-history/backfill_schema_migrations_2026-08-16.md`, migrations past 064 are not tracked in `supabase_migrations.schema_migrations` — expected, not a blocker.)
- `lib/supabase/types.ts`: `tournaments.division: number | null` added to Row/Insert/Update.

### Zone helpers
- `lib/standings-core.ts`: `StandingsZones` type; `normalizeStandingsZones(settings)` reads `settings.standings_zones` jsonb from the tournament row; `rowZone(zones, index, total)` (order: top_green → top_yellow → bottom_red → bottom_yellow); `ZONE_BORDER_CLASS` (`border-l-emerald-500`/`border-l-yellow-400`/`border-l-red-500`); `zoneLegend(zones)` for dynamic legends. Zone config is stored on each tournament, not hardcoded in the UI:
  - Div 1 → `{ bottom_yellow: 2, bottom_red: 3 }` (12/13 yellow, 14/15/16 red)
  - Div 2 → `{ top_green: 3, top_yellow: 2 }` (1–3 green, 4/5 yellow)

### Standings UI
- `app/(public)/standings/page.tsx`: tournament select includes `division`.
- `app/(public)/standings/_desktop.tsx` and `_mobile.tsx`: league border logic switched from the hardcoded UCL/Europa classes to `rowZone`/`ZONE_BORDER_CLASS`, dynamic legend via `zoneLegend`, select/chips show `— Division {t.division}` for league-type tournaments. Old UCL/Europa legend and hardcoded 12/20 slices removed.

### API routes
- `app/api/admin/start-phase/route.ts`: accepts `division1_teams`/`division2_teams` and `division1_users`/`division2_users`; each division resolves to slots (user-driven uses each user's current club), validates `slots.length % 2 === 0` (400 if odd) and min 2; creates two `league` tournaments with `division` + zoning `settings.standings_zones`, participants, standings rows, two-round fixtures, separate standings tables; `end_date` computed from the combined fixture total and written into each tournament's `settings.end_date` and the season row. Legacy `league_teams`/`league_users` shape still maps to a single Division 1 league.
- `app/api/admin/end-season/route.ts`: fetches all league tournaments (ordered by division); requires every division's fixtures complete; marks all league tournaments + the season completed; per-division outcome notifications via `insertNotificationsAndPush` (Div 1 champion / relegation / relegation playoff; Div 2 promotion / promotion playoff) so Div 2 loses the promotion playoff through post-season handling; audit log with per-division standings. Zones fallback: `div.settings?.standings_zones ?? {bottom_yellow:2,bottom_red:3} | {top_green:3,top_yellow:2}`.
- `app/api/admin/start-tournament/route.ts`: fetches all league tournaments (not `.single()`); completeness checked across all; team whitelist = participants of all league tournament ids; per-division `rankByTeam` with `rankOffset` seeding Div 1 teams ahead of Div 2; `lastLeagueFixture` uses `.in('tournament_id', leagueTIds)`; import switched to `sortStandingsRows`.

### Admin UI
- `app/(admin)/admin/seasons/page.tsx`: each season now carries `league_tournaments` (`{id,name,division,status,fixture_count,completed_count}`), summed `league_total_fixtures`/`league_completed_fixtures`, `final_standings_by_division` (keyed by division number), merged `final_standings`, and `cup_taken`.
- `app/(admin)/admin/seasons/SeasonManager.tsx`:
  - `FinalStandingRow.division`, `Tournament.division`, new `LeagueDivision` type, `Season.league_tournaments`/`final_standings_by_division`.
  - `SeasonCard`: one progress bar per division (uses `league_tournaments` counts); "all done" = aggregate of all divisions; still keeps a single first-league reference for cup startability.
  - `StartPhaseDialog`: Division 1 / Division 2 tab switcher with its own search, Import-from-Poll, per-division even-count validation, cross-division locking (badge "in Division 2/1"), defaults to 16 + 16 teams, and posts `division1_teams`/`division2_teams`.
  - `StartCupDialog`: replaced the auto top-N "Teams" input with manual multi-select of rows grouped by Division (headers), locked rows already taken by the other competition (`otherBadge`), keeps groups + qualify-per-group + even-divisibility validation, posts the chosen `team_ids`.
- Unrelated build blocker MIA: `lib/phone.ts:24` `let digits` → `const` (pre-existing `prefer-const` error blocking `next build`).

### Verification
- `npx tsc --noEmit` clean.
- `npx eslint` clean on all touched files.
- `npm run build` succeeds.

## Next steps / notes
- No DB tracking gap beyond the known 064 bookkeeping issue.
- Anything that still reads a single league per season (e.g. WhatsApp manager stats, forfeit balances) now reads division 1's tournament; if those flows need division awareness, that is follow-up work.