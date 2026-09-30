# Per-fixture match codes — generation at fixture-creation + Season 4 backfill

Added a `match_codes` table plus a DB trigger so every fixture gets a unique
8-char code at the moment it is created (covering bulk generate-fixtures,
start-season, knockout / super-cup / friendly inserts, and TBC games with no
date), then backfilled codes for all 608 fixtures already scheduled in the
current season. This is the data layer for the proposed WhatsApp match-centre
deep links (`.opencode/context/whatsapp-ux/match-centre-deep-links_2026-09-30.md`):
the dashboard reminder link will embed `MC-<code>` and the webhook will resolve
code → fixture.

## Problem

The match-centre design needs one stable, collision-free code per fixture that
exists for the whole season — including games that are still TBC/unscheduled and
knockout fixtures generated later. Generating codes lazily from the dashboard
("on demand") was rejected by the user: codes must be assigned during the
fixture-generation step itself. Fixtures are created through many paths
(`generate-fixtures`, `start-season`, `generate-knockouts`, `generate-super-cup`,
`generate-friendlies`), so a per-row DB trigger is the single mechanism that
covers every path atomically.

## Fix (migration `084_match_codes.sql`, applied live)

1. `public.match_codes` table: `id uuid pk default gen_random_uuid()`,
   `fixture_id uuid unique references fixtures(id) on delete cascade`,
   `code text unique`, `created_at`. One code per fixture; deleting a fixture
   (e.g. `cancel-season`) removes its code.
2. `public.match_code_for_fixture(uuid) returns text` allocator: random 8-char
   code from an unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`,
   no 0/O/1/I), performing its own INSERT and retrying on `unique_violation` —
   this is the single source of truth used by both the trigger and the backfill.
3. `public.assign_match_code()` — `AFTER INSERT` trigger `trg_assign_match_code`
   on `fixtures`. **Critical detail:** it must be AFTER INSERT, not BEFORE —
   in a BEFORE trigger the parent `fixtures` row is not yet visible, so the
   `match_codes.fixture_id` FK check fails ("violates foreign key constraint
   `match_codes_fixture_id_fkey`"). AFTER INSERT the parent tuple exists and the
   child insert succeeds.
4. Data API grants (belt-and-braces; default privileges from 076 also cover
   these): full table grants + `EXECUTE` on both functions for
   `service_role, anon, authenticated`.
5. Season 4 backfill (`season_id 912d5ea4-5e4e-493b-8308-0745ad338a1a`, all
   tournaments: Betway Premiership, Motsepe Foundation Championship, CAF
   Champions League, CAF Confederations League, Nedbank Cup, CAF Super Cup):
   `select public.match_code_for_fixture(f.id) ... ` guarded by
   `not exists (select 1 from match_codes ...)` so it is idempotent.

## Verification (live)

- 608 fixtures → 608 match_codes, all 8 chars, `count(distinct code) = 608`.
- Grants present for anon/authenticated/service_role/postgres.
- Trigger proven live: inserted throwaway fixtures (incl. one **TBC** —
  `scheduled_date` null) and each automatically received a valid
  `^[A-Z2-9]{8}$` code; deleting the fixtures cascade-deleted their codes.
  Test rows were removed; count back to 608.
- Earlier failed run (BEFORE INSERT trigger) rolled back atomically and left no
  objects — confirmed via `to_regclass`/`to_regprocedure` before retrying.
- Sample join output confirms codes pair correctly to teams/dates, e.g.
  Sekhukhune United vs Wits Sport → `3D6K689L` (confirm code-style links for
  the reminder templates: `https://wa.me/27818209406?text=Hi MC-3D6K689L`).

## Gotchas / Notes

- Bulk fixture inserts (array `.insert(fixtureRows)` in `generate-fixtures`) fire
  the row trigger per row; the allocator's retry loop absorbs any unlucky
  duplicate.
- Data-modifying CTEs run correctly inside `npm run db` but node-pg only
  surfaces the LAST statement's result — test scripts should put the SELECT last
  or use a plain INSERT ... RETURNING.
- The webhook reverse lookup (code → fixture) and the dashboard link builders
  are NOT yet implemented; this migration and backfill are the prerequisite.

## Cross-references

- Feature intent/plan: `.opencode/context/whatsapp-ux/match-centre-deep-links_2026-09-30.md`
- Reminder-link mechanics being extended:
  `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md`
  and `.opencode/context/admin-dashboard/whatsapp-reminder-link-session-expiry_2026-09-22.md`
- Grants safety net: `.opencode/context/migration-history/data-api-default-privileges_2026-09-23.md`
- Manager-cleanup migration that precedes this file in the same series:
  `.opencode/context/user-management/reassign-hungry-lions-maninblack-delete-hunger_2026-09-30.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |