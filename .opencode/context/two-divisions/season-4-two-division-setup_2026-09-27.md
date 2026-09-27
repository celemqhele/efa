# Season 4 Setup — Two Divisions, Two CAF Competitions, 32-Club Nedbank Cup, Super Cup Shell

Created Season 4 live in the database with all five competitions plus a CAF Super Cup shell, using a new one-off maintenance script `scripts/create-season4.ts`. This follows the manager-tenure reset documented in `.opencode/context/onboarding/global-reset-manager-tenures-season-rollover_2026-09-27.md` and consumes the club-selection poll results assigned in `.opencode/context/poll-tournament-integration/assign-poll-results-club-selection_2026-09-27.md`.

## Problem

The admin wanted Season 4 to start Monday 2026-09-28 as a two-division season, but there was no way to create it as specified:

- `app/api/admin/start-phase/route.ts` hardcodes the season name, `base_league` (`'EFA Premier League'`) and league names (`'EFA Premier League'` / `'EFA Championship'`). Season 4 needs `base_league = 'Betway Premiership'` and the names `Betway Premiership` / `Motsepe Foundation Championship`, per `.opencode/context/south-african-premiership/add-sa-premiership_2026-08-27.md`.
- `app/api/admin/start-tournament/route.ts` refuses to create a second `tournament_club` competition while another one is still live, but the season needs **two** CAF competitions (Champions League *and* Confederations League). The database allows both; only the route blocks it.
- Nothing supported a 32-team knockout bracket. The generator only handled 4, 8 and 16 teams, so the Nedbank Cup's true first round (R32) could not be created.
- There was no way to have a Super Cup exist visibly before its participants are known.

## Fix

### New one-off script
- `scripts/create-season4.ts`: resolves the roster, creates the season, then both leagues, both CAF competitions, the Nedbank Cup and the Super Cup shell, generating fixtures for each. Aborts if a season named `Season 4` already exists, so it is safe to re-run only when nothing was written.

### R32 (32-team) knockout support
- `supabase/migrations/077_add_r32_round_type.sql`: adds `r32` to the `fixtures_round_type_check` constraint. Applied and verified.
- `lib/tournament-rounds.ts` (new): shared `KO_ROUNDS` list and round labels, replacing hardcoded round arrays across the cron, webhook, finalisation and admin tournament routes.
- `lib/tournament-progression.ts`:
  - `KnockoutRound` gains `r32`; `BRACKET_PROGRESSION` gains the 401–416 → 51–58 band; `ROUND_STAGE_OFFSET` gives `r32` an offset of `-1`.
  - A 32-team bracket is **single-leg only**; asking for two legs returns `A 32-team bracket is single-leg only (R32 has no leg-2 band)`.
  - `assignKnockoutDates()` now anchors a tournament with no group stage to its own `settings.start_date` instead of `today`, so a straight knockout can be scheduled after the leagues rather than immediately.
  - Super Cup selection now prefers `settings.is_continental` and reads `settings.super_cup_name`, so it can no longer pick the Nedbank Cup, and the generated fixture uses `round_type: 'super_cup'` so final-award handling does not recurse into itself (see `.opencode/context/knockout-generation/auto-super-cup-generation_2026-08-25.md` and `.opencode/context/knockout-generation/super-cup-bugfix_2026-08-26.md`).

### Super Cup shell adoption
- `checkAndCreateSuperCup()` used to return early whenever the shell already held any fixture, which would have permanently blocked a pre-created placeholder. It now scans the shell's fixtures: if a fixture has real teams the Super Cup is settled and it returns; if the only fixture is a TBC placeholder it adopts the shell and **updates that placeholder in place** once the CAF winners are known.

### Environment note for one-off scripts
No env file in this repo actually contains `NEXT_PUBLIC_SUPABASE_URL` — `.env.local`, `.env.prod` and `.env.vercel` all ship it empty, and Node's `loadEnvFile` never overrides an existing key, so it stays empty even after loading. `SUPABASE_DB_URL` in `.env.supabase` points at the Supavisor pooler host (`aws-0-eu-west-1.pooler.supabase.com`), which does not contain the project ref either. Both scripts therefore derive the URL from the `ref` claim inside the service-role JWT:

```ts
const ref = JSON.parse(Buffer.from(process.env.SUPABASE_SERVICE_ROLE_KEY.split('.')[1], 'base64').toString('utf8')).ref
process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`
```

Without this, any one-off script using `createAdminClient()` fails with `Missing NEXT_PUBLIC_SUPABASE_URL`.

## What was created

- **Season 4** — `912d5ea4-5e4e-493b-8308-0745ad338a1a`, status `active`, 2026-09-28 → 2026-11-04, `base_league = 'Betway Premiership'`.
- **Betway Premiership** (Division 1, 16 clubs, 240 fixtures) and **Motsepe Foundation Championship** (Division 2, 16 clubs, 240 fixtures) — double round robin, both ending 2026-10-27. Division 2 holds 13 managers plus 3 vacant clubs: Leicesterford City, Lerumo Lions, Upington City.
- Zones match `.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md`: Division 1 `{ bottom_yellow: 2, bottom_red: 3 }`, Division 2 `{ top_green: 3, top_yellow: 2 }`. The user confirmed the asymmetry is intentional.
- **CAF Champions League** and **CAF Confederations League** — 4 groups × 4 clubs, 2 group rounds, `qualifiers_per_group: 1`, `is_continental: true`, 48 group fixtures each, 2026-10-28 → 2026-11-02. Groups are seeded by club record per `.opencode/context/draw-seeding/draw-seeding-club-records_2026-09-02.md`.
- **Nedbank Cup** — all 32 clubs, `num_teams: 32`, `num_legs: 1`, 31 fixtures: 16 R32 + 8 R16 + 4 QF + 2 SF + 1 final, 2026-10-31 → 2026-11-04.
- **CAF Super Cup** — `friendlies` tournament with `settings.is_super_cup`, one TBC placeholder fixture on 2026-11-04. Its date and teams are filled in automatically by `checkAndCreateSuperCup()` after the CAF finals.

**608 fixtures total.** The remaining 26 are the CAF knockout brackets (13 each). These are deliberately **not** pre-created: `generateTBCKnockouts()` returns early when knockout fixtures already exist, so a pre-built empty bracket would permanently block the admin *Generate Knockouts* action. The user chose to keep the canonical post-group-stage flow, matching `.opencode/context/season-cup-flow/deferred-ucl-uel-start_2026-08-23.md`. Total becomes 634 once knockouts are generated.

## Verification
- `npx tsc --noEmit` clean.
- 0 cases of a club playing twice on the same date across the whole season.
- Every one of the 32 clubs has exactly 15 home + 15 away league fixtures.
- Both leagues have 16 participants and 16 standings rows; R32 contains 16 ties and all 32 clubs appear exactly once.
- Note: the real scheduler rule is `q = floor(2 * weeklyMatches / N)` games per 7-day window (`lib/fixture-slots.ts`), i.e. 7 per club per week at 16 clubs, plus at most one match per club per day and at most 8 matches per day. A rolling 7-day count can therefore exceed 7; that is by design, not a violation.

## Next steps / notes
- `app/api/admin/start-phase/route.ts` still hardcodes the old season/league names and `base_league`, so the admin *Start Phase* dialog cannot reproduce Season 4. `scripts/create-season4.ts` bypasses it.
- `app/api/admin/start-tournament/route.ts` still blocks a second live `tournament_club` competition.
- A stale `Phase 1` season (2026-05-17 → 2026-07-01) is still `upcoming`; the new season is the only `active` one.
