# End all manager tenures across all accounts (28 Aug)

On 2026-08-28, all 7 open `manager_tenures` (one per team that still had a manager) were ended
at `now()` and every `teams.manager_id` was cleared to `NULL`, giving the league a clean slate
of managerless teams. This is a one-off data operation following the same cleanup pattern the
end-season flow performs (see `.opencode/context/onboarding/manager-data-transfer_2026-08-25.md`
for how tenures are the source of truth for manager/team history).

## What was done

- Migration `supabase/migrations/063_end_all_manager_tenures.sql`:
  1. `UPDATE manager_tenures SET ended_at = now() WHERE ended_at IS NULL` → all 7 open tenures closed.
  2. `UPDATE teams SET manager_id = NULL WHERE manager_id IS NOT NULL` → 7 teams released.
- Verified live: `open_tenures = 0`, `teams_with_manager = 0`.

## Teams/tenures affected (before)

| Team | Manager |
|------|---------|
| Al Nassr | maestro_boy_7 |
| Atletico Madrid | nkosithegreat2009 |
| Crystal Palace | khumoshxta_ |
| England | nkosinathi_ |
| New Zealand | efb_langadube |
| South Korea | langa |
| Switzerland | maestro_boy7 |

## Design decision

`sacked_at` was intentionally **not** set on any profile: the normal sack flow
(`app/api/admin/managers/sack/route.ts`) sets it to trigger the 7-day reassignment cooldown.
A global tenure sweep implies immediate reassignment, so the cooldown was skipped — mirroring
`app/api/admin/end-season/route.ts`, which also ends tenures without touching `sacked_at`.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | Non-reversible live data update (tenures closed, managers released) | N/A |