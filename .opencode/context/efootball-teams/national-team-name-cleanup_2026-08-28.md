# National Team Name Cleanup — 2026-08-28

Removed the trailing **"National Team"** from national-team names so they show just the country name (e.g. `Cote D Ivoire National Team` → `Cote D Ivoire`, `Usa National Team` → `USA`) across the Supabase `teams` table, the alias seed data, the DNA script, and the two places that derived display names from logo slugs at runtime.

## Problem

Ten national teams in the DB still carried a "National Team" suffix that the other national teams (Algeria, Brazil, France, etc.) had already shed:

`Austria`, `Cabo Verde`, `Canada`, `Colombia`, `Cote D Ivoire`, `Panama`, `Senegal`, `Sweden`, `Tunisia` — all still stored as `<Country> National Team`, plus `Usa National Team` which also had the `Usa`/`USA` capitalization inconsistency. This naming leaked into UI surfaces that read `teams.name` directly, and two code paths derived display names from `*_national_team` logo slugs (`app/api/search/route.ts` built `Cote D Ivoire National Team` from the slug; `lib/logo-resolver.ts` `slugToName` fallback did the same).

## Fix

### Supabase
- Created `supabase/migrations/064_clean_national_team_names.sql` with 10 explicit `UPDATE public.teams` statements (per-team, no REPLACE collateral) and ran it via `npm run db`. Teams with `National Team` in the name: verified zero remain; the 10 renamed rows re-checked by id. `team_aliases` reference `team_id`, so aliases were unaffected (USA still resolves its `usa` alias).
- Recorded version `064` in `supabase_migrations.schema_migrations` (statements array + name `clean_national_team_names`) via a one-off statement. The full backfill script (`scripts/backfill-migration-history.ts`) was intentionally NOT run because migration `063_end_all_manager_tenures.sql` is not yet applied (26 teams still had `manager_id`), and running the backfill would have marked 060–063 as tracked.

### Project files
- `supabase/seed/team_aliases_data.sql` — dropped ` National Team` from every national-team name reference and comment (59 changed lines) so a re-run resolves the rows against the now-clean DB names.
- `scripts/populate-tournament-dna.ts` — dropped ` National Team` from all `TEAM_PROFILE_MAP` keys (`'Argentina'`, `'USA'`, …). The map keys now match the DB names, so the manual DNA profiles apply instead of silently falling through to the generic fallback, and the teams this change renamed (Canada/Colombia/Panama/Senegal/Sweden/Tunisia/Austria/USA) keep their intended profiles.
- `lib/registry.ts` — exported `slugToName` (its `NATIONAL_NAMES` override map already produced clean names).
- `app/api/search/route.ts` — country results now label via `slugToName(slug, true)` instead of inline title-casing the slug, so search shows `Côte d'Ivoire`, `USA`, `Cabo Verde`, etc. instead of `Cote D Ivoire National Team`.
- `lib/logo-resolver.ts` — `slugToName` (used by `slugToDisplayName` fallback in admin seasons/tournament-create pages) now strips trailing `-national-team` / `-football-federation` tokens; added `usa-national-team → USA` and `portuguese-football-federation → Portugal` overrides.
- `lib/clean-team-name.ts` runtime cleaner left in place — it is now a no-op but harmless.

## Verification
- `npx tsc --noEmit` → clean. `npm run lint` → no new warnings/errors in changed files.
- Search/query of `teams` for `%national%` / `%team%` returns only `USA`.
- `SELECT name, array_agg(alias)` for the 10 teams — aliases intact.

## Related files
- `.opencode/context/efootball-teams/efootball_teams_2026-08-15.md` — the eFootball 2027 roster work these national teams belong to.
- `.opencode/context/efootball-teams/polls-international-teams-empty_2026-08-25.md` — poll international-team list built from the logo registry (already named cleanly via `slugToName`).
- `.opencode/context/migration-history/backfill_schema_migrations_2026-08-16.md` — the schema_migrations bookkeeping method; version `064` was recorded directly to avoid marking unapplied `063`.