# Vacant slot auto-forfeit: group fixtures stuck on "scheduled"

Fixed the vacancy auto-forfeit path (`vacateUserSlots`) leaving **group-stage** fixtures stuck on `scheduled` when they fell due today/past. The user reported that after disqualifying a team, the auto-forfeit applied (Vacant 0-3 Egypt, MD52) but the fixture stayed "scheduled" for a game due that day (they manually added the backdoor loss afterward).

## Problem

In migration 066's `update_standings_after_result()` result trigger (also live in the DB):
- The **confirmed_pending guard** (`scheduled_date::date > CURRENT_DATE`) handles *future-dated* results → `confirmed_pending`, promoted later by the flip-pending cron. This worked: other vacated fixtures (Norway/Uruguay vs Vacant, MD88/MD93) ended up correctly `confirmed_pending`.
- For a **due-today** (or past) group fixture, execution fell into the `round_type='group'` branch, which upserted `group_standings` and then `RETURN NEW` **without** setting `fixtures.status`. Only the league branch reached the `UPDATE fixtures SET status='confirmed'` at the end of the function. Result: standings applied, fixture left `scheduled`.

Manual admin result submissions masked the bug because `app/api/admin/finalise-result/route.ts` verifies the fixture status after the upsert and falls back to a direct `status='confirmed'` update — the vacancy auto-forfeit path has no such fallback.

Culprit fixture (now manually confirmed by the user): MD52 `0e0c1aa0-a07e-40ef-b851-e49478c8fc42` (Vacant 0-3 Egypt, `e2c61a3e...` tournament, group C). Disqualify audit at `2026-09-09T03:23:12Z` matches the result row `created_at` `03:23:11Z`.

## Fix

New migration **`supabase/migrations/074_fix_group_result_status_confirm.sql`** — `CREATE OR REPLACE FUNCTION public.update_standings_after_result()` = the 066 version plus **one added line** inside the group branch before `RETURN NEW`:

```sql
UPDATE fixtures SET status = 'confirmed' WHERE id = NEW.fixture_id;
```

No later migration redefines this function (checked: only 003, 065, 066), and the `on_result_insert` trigger is unchanged — the function replacement is sufficient. Applied via `npm run db`.

## Verification

- `pg_get_functiondef` dump confirms the group branch now contains the status update after the `away_gdp_inc` standings upsert.
- Stuck-fixture query (`status='scheduled'` + absent override_reason, league/group) → **0 rows**.
- Live transactional proof (single `DO` block that always raises, so the aborted statement rolls back): inserted a fake due-today group fixture (Vacant vs Egypt, matchday 78322) + auto-forfeit result → `ERROR: STATUS_CHECK::confirmed` shows the trigger now flips status to `confirmed`. No residue left (leftover count 0).

## Restore File Section

- `tmp-verify-group-forfeit-test.sql` (temporary SQL proof) moved to `.recycle/supabase/migrations/tmp-verify-group-forfeit-test.sql` — restore to repo root if the live trigger check ever needs re-running.

## Cross-references

- This is a follow-up on the vacancy auto-forfeit introduced in `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`.
- Supercedes the standings-trigger behavior from `supabase/migrations/066_user_based_slots.sql` (and its predecessor 065).
- Forfeit/absent result outcome strings are shared with `app/api/admin/finalise-result/route.ts` (manual path).