# Vacant sweep missed unowned seats + case-sensitive "both absent" mis-awarded a win

## Intro
Follow-up to the vacancy chain in `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md` and `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`: the user noticed that Season 4's two still-vacant clubs (Lerumo Lions, Upington City) were not auto-losing, even though they have no manager. Chasing it found two separate bugs — the hourly sweep could not see vacancies that hold a real club, and once it was fixed, the result trigger mis-scored a vacant-vs-vacant fixture as a 3-0 home win because Postgres `LIKE` is case-sensitive.

## Problem

### 1. The sweep only recognised one of the two vacancy representations
`sweep_vacant_slots()` (migration `067`) detected a vacancy by looking for a single literal placeholder row:

```sql
SELECT id INTO v_vacant_team FROM teams
WHERE logo_league_folder = 'custom' AND logo_team_slug = 'vacant' LIMIT 1;
```

That only ever matches seats vacated **at runtime** by `vacateUserSlots()`, which overwrites the participant's `team_id` with the `custom/vacant` placeholder (`lib/slot-utils.ts:167-180`).

Season 4 creates its vacant seats a completely different way. `stampFixtureParticipants()` (`lib/slot-utils.ts:799`) inserts participants with the **real club** in `team_id` and `user_id = NULL`, and the fixtures keep the real club ids. Those seats are genuinely ownerless but were invisible to the sweep.

Result: the `pg_cron` job was alive and firing hourly (`0 * * * *`, `cron.job` jobid 8) and matching **zero** rows. Season 4 had 0 fixtures involving the placeholder team, so Lerumo Lions' and Upington City's past-due fixtures never finalised and their opponents waited forever. 36 fixtures per club were exposed (30 Motsepe league + 6 CAF CL group); the `r32` Nedbank Cup tie is correctly outside the filter.

### 2. `LIKE '%both%'` never matched, so a 0-0 void was booked as a 3-0 win
After widening the sweep, the one overdue fixture — Lerumo Lions v Upington City, **both sides vacant** — was written as a 0-0 with reason `'Both slots vacant and absent — void (0-0)'`, but the standings trigger (`update_standings_after_result()`, migration `065`) booked Lerumo Lions as **W 1, GF 3, 3 points** and Upington as `absent 1`.

The trigger splits the no-show branch with `v_reason LIKE '%both%'`. **Postgres `LIKE` is case-sensitive** and the string starts with a capital `B`, so the test failed and control fell through to the trailing `ELSE` — the "Away absent (score = 3-0)" branch. The wrong side got a win it never played for.

This was pre-existing and latent: the both-vacant branch had never been exercised, because the only caller of that path (the 067 sweep on the placeholder) had not produced a both-vacant fixture.

## Fix

### `supabase/migrations/079_vacant_sweep_unowned_seats.sql`
Widens the vacancy test to the real slot definition — the participant row behind the fixture's side has no owner — while keeping the 067 behaviour intact:

- **new model**: a `(tournament_id, team_id)` participant with `user_id IS NULL`
- **legacy model**: the side's `team_id` is still the `custom/vacant` placeholder

Matching on the `(tournament_id, team_id)` pair rather than `home/away_participant_id` is deliberate: it is the canonical seat identity and still works on fixtures whose participant ids were never stamped. Everything else is unchanged from 067 — only past-due, still-`scheduled` `league`/`group` fixtures with no result row, same 0-3 / 3-0 / 0-0 scores, same `override_reason` strings, `is_abandoned = false`, `finalised_by = NULL`. The hourly cron is left in place; it simply had nothing to match before.

**Future-dated fixtures are deliberately still left alone.** Sweeping them would stamp forfeits that `reclaimManagerSlots()` never clears — only `assignVacantSeatToManager()` calls `clearAutoForfeitResults()` — so a manager assigned later would inherit a season of losses. Past-due only means a seat filled mid-season inherits just the matches that already happened, which is the intended slot-follows-team continuity.

### `supabase/migrations/080_fix_both_absent_case_sensitive.sql`
Switches both trigger tests to `ILIKE`. The function is patched in place off its own live definition via `pg_get_functiondef` + `replace()` rather than re-declared, so the migration cannot drift from the deployed body; `pg_get_functiondef` emits `CREATE OR REPLACE`, so the `on_result_insert` trigger stays bound to the same OID. A guard raises if the expected literals are absent, so it can never fail silently, and an early `RETURN` makes re-runs no-ops.

Fixed the trigger rather than rewording the reason string because `clearAutoForfeitResults()` (`lib/slot-utils.ts:652`) matches that string with case-sensitive `startsWith('Both slots vacant')` to withdraw auto-forfeits when a seat is later filled. Keeping the string and making the trigger tolerant is the safer pairing.

The same migration repairs the one mis-scored fixture. `trigger_recalc_on_result()` only rebuilds `manager_tenures` stats, so deleting a result does **not** roll league standings back — the two rows are reset explicitly first. The reset is guarded on "this fixture is that side's only result", which is what makes it safe: the buggy state is asymmetric (the wrong branch gave home `wins=1/pts=3` and away `absent=1`), so a guard encoding the wrong shape would have reset only one row.

### `supabase/migrations/081_season4_manager_phone_updates.sql`
Separate backfill of two Div 2 manager numbers (`dimarco_32`, `ozilotf_`) supplied while assembling the WhatsApp group lists.

## Verification
- Dry-run of the exact 079 predicate against live data: matches **exactly 1** fixture, correctly flagging `home_vacant = true` and `away_vacant = true`. No collateral matches.
- `SELECT sweep_vacant_slots()` → `1`. The fixture moved `scheduled` → `confirmed` with `0-0`, reason `'Both slots vacant and absent — void (0-0)'`, `is_abandoned = false`, `finalised_by = null`.
- Standings after repair: both clubs `played 1, W 0, D 0, L 0, GF 0, GA 0, pts 0, absent 1, gd_penalty -3` — the intended both-absent void.
- Trigger confirmed patched: `ILIKE '%both%'` and `ILIKE '%absent%'` present, old `LIKE '%both%'` gone.
- Second `sweep_vacant_slots()` → `0`, confirming no double-counting.
- **Single-vacant branch proven** on a throwaway transaction that back-dated a real fixture and let the real sweep + trigger run: `Orbit College v Lerumo Lions` → `3-0`, reason `'Vacant slot absent — automatic 3-0'`, `is_abandoned = false`, and the managed side moved `played 1→2, wins 0→1, points 0→3, GF 0→3`. The block raises at the end, aborting and rolling everything back — verified afterwards that Season 4 still had exactly 11 results and Orbit was back to `P 1, GA 11`.
- All 10 human-entered results in Season 4 untouched (`override_reason IS NULL`).
- `npx tsc --noEmit`: clean (no TS changed).
- Leicesterford City correctly excluded throughout once `mubizamaan` claimed the seat.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Vacancy model this extends: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`
- Vacate-time auto-forfeit that shares the reason strings: `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`
- Seat reclaim (why future-dated sweeps are unsafe): `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`
- Vacant takeover path that *does* clear auto-forfeits: `.opencode/context/user-based-competitions/vacant-seat-manager-takeover_2026-09-05.md`
- Vacant group-stage status handling: `.opencode/context/user-based-competitions/vacant-group-forfeit-status-fix_2026-09-09.md`
- Standings seat-first resolution (why the reset is keyed on participant rows): `.opencode/context/user-based-competitions/standings-seat-first-resolve_2026-09-20.md`
- Original sweep: `supabase/migrations/067_vacant_sweep.sql`
- Trigger with the `LIKE` tests and the confirmed-pending guard: `supabase/migrations/065_confirmed_pending.sql`
- Phone backfill detail: `.opencode/context/check-fixtures/manager-phone-backfill_2026-09-29.md`
- Auto phone-update flow these numbers interact with: `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`

## Notes / follow-ups
- `reclaimManagerSlots()` still does not call `clearAutoForfeitResults()`. It is safe today only because 079 never stamps future-dated results, so a reclaimed seat has nothing to clear. Any future change that starts stamping future forfeits must fix that path first.
- `update_standings_after_result()` was patched by string replacement, so its source of truth remains migration `065`. If `065` is ever re-run on a fresh database, the case-sensitivity bug returns — `080` must always be applied after it, and the in-place patch means `080` has to be the last word on that function.
- Knockout rounds (`r32` and later) are still never auto-swept, matching the existing precedent that empty-best should not fast-play knockouts. CAF's 26 knockout fixtures remain deferred until admin **Generate Knockouts**, as before.
- Two of thirty Season 4 managers still have no number on file: `hunger_` (Hungry Lions) and `wamashudu` (Orbit College). Lerumo Lions and Upington City have no manager at all, so they have no contact.
- `npm run db -- -c` silently discards **multi-line** SQL strings — it only ever ran the first statement region and reported nothing. Write single-line SQL for `-c`, or put the SQL in a file and pass the path.
