# Global manager reset for the new season + sack-cooldown reset script

Re-ran the global manager sweep for the new season (34 open tenures closed, 34 clubs released), and added
`global_reset_sack_cooldown.sql` as the SQL-only bulk override for clearing `profiles.sacked_at`.

This is the second execution of the same cleanup. The prior run on 2026-08-28 closed only 7 tenures
(`.opencode/context/onboarding/end-all-manager-tenures_2026-08-28.md`, migration
`supabase/migrations/063_end_all_manager_tenures.sql`); the state had since drifted again as new tenures
were created, so `063`'s logic was re-applied as a new, clearly-named migration rather than editing `063`
in place (migrations are historical records). This continues that chain and follows the same decision to
leave `sacked_at` alone.

## What was done

1. `supabase/migrations/global_reset_manager_tenures.sql`:
   - `UPDATE manager_tenures SET ended_at = now() WHERE ended_at IS NULL` → **34 tenures closed**.
   - `UPDATE teams SET manager_id = NULL WHERE manager_id IS NOT NULL` → **34 clubs released**.
2. `supabase/migrations/global_reset_sack_cooldown.sql`: `UPDATE profiles SET sacked_at = NULL
   WHERE sacked_at IS NOT NULL` → **18 rows cleared**.

Pre-flight checks confirmed the season was genuinely over before touching anything: all 11 tournaments
were `status = 'completed'` (zero active/draft/upcoming), and there were 0 pending `team_change_requests`,
so no in-flight tournament seats or pending admin approvals were left inconsistent.

A rollback snapshot of the 34 club → manager pairings and 34 open tenures was captured to
`C:\Users\mqhel\AppData\Local\Temp\opencode\pre_reset_backup_OUTPUT.txt` before the write.

## Verified end state

| Check | Value |
| ----- | ----- |
| Open tenures immediately after reset | 0 |
| Clubs still held immediately after reset | 0 |
| `manager_tenures` rows (career history preserved) | 205 → 234 after the 29 new assignments |
| `profiles.sacked_at IS NOT NULL` | 18 → 0 |

## Why `sacked_at` is not an "unemployed" flag

Worth writing down because the column name is misleading and it caused a wrong instinct during planning.
In this codebase `sacked_at` is a **7-day reassignment cooldown**, nothing else:

- **Nothing reads it for display.** No UI filters, hides or badges anyone on it. There is no `SACKED` badge
  anywhere. `app/api/search/route.ts`, the public profile page, the admin user list and the admin team grid
  all select profiles without it, and every "No team" / "(Available)" label keys off `teams.manager_id`
  instead.
- **Its only effect is a gate** at four call sites, each of which has its own `override`:
  `app/api/admin/managers/assign/route.ts:68` (409 `SACK_COOLDOWN`), `lib/slot-utils.ts:692`
  (`approveSeasonApplication`), `app/api/webhook/route.ts:3204` (WhatsApp application), and
  `app/(admin)/admin/tournament-applications/_review.tsx`.
- **It is written in 3 places and never cleared anywhere in the repo** — `app/api/admin/managers/sack/route.ts:32`,
  `app/api/admin/sack/route.ts:31`, `app/api/admin/finalise-result/route.ts:74`. A repo-wide search for
  `sacked_at: null` returns zero matches. So a value from months ago lingers forever as a meaningless
  marker, and 18 profiles were carrying one.
- **`teams.manager_id` is the canonical "has a club" signal**, with `manager_tenures.ended_at IS NULL` as a
  redundant second representation that the public profile page uses for "current club".

So stamping `sacked_at` on a global sweep would have been actively harmful: it would have blocked the ~60
managers who were *not* picking up a club in the accompanying poll assignment from being assigned anything
for a week. Migration `063` already documented this reasoning and it still holds.

`global_reset_sack_cooldown.sql` now exists as the bulk escape hatch, since the app offers no global
override — each gate can only be bypassed one at a time with its own `override` flag, so clearing everyone
is SQL-only by design. It only nulls a nullable column and is safe to re-run.

## `abandon_count` deliberately left alone

56 of 141 teams carry 315 lifetime abandonments. Left untouched by explicit decision: it is lifetime club
history, it feeds forfeit logic (`forfeit_balances`), and `supabase/functions/abandonment-cron/index.ts:132`
alerts admins to review a club for sacking at `>= 3`. All 29 clubs handed out in the accompanying poll
assignment already sat at `abandon_count = 0`, so it made no difference to that outcome either way.

## Related

- `.opencode/context/onboarding/end-all-manager-tenures_2026-08-28.md` — the first (7-tenure) run of this sweep.
- `.opencode/context/onboarding/manager-data-transfer_2026-08-25.md` — why tenures are the source of truth for history.
- `.opencode/context/poll-tournament-integration/assign-poll-results-club-selection_2026-09-27.md` — the club assignments that ran immediately after this reset.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | Non-reversible live data update (tenures closed, managers released, cooldowns cleared) | N/A |
