# Terminal manager-assign script + filling the two vacant Season 4 seats

## Intro
Follow-up to `.opencode/context/user-based-competitions/vacant-sweep-misses-unowned-seats_2026-09-29.md`, which left Lerumo Lions and Upington City as the only two Season 4 clubs with no manager. The user asked for those two seats to be filled before committing, and also for the two incoming managers' phone numbers. The admin assign route needs an interactive admin Supabase session, so a terminal script was added that mirrors it, and it was used to complete the fill.

## Problem
- `app/api/admin/managers/assign/route.ts` is only reachable with an authenticated admin session, so filling seats from the terminal meant either hand-writing SQL (risking divergence from the route) or driving the browser. There was no `scripts/` equivalent, unlike season creation (`scripts/create-season4.ts`).
- Lerumo Lions and Upington City had `teams.manager_id = null` and `tournament_participants.user_id = null` in all three of their tournaments (Motsepe, CAF CL, Nedbank Cup) — 6 seats total.
- Their managers' numbers were unusable or missing: `dot` had a **malformed** stored value and `karabo_` had none at all.

## Fix

### `scripts/assign-manager-to-club.ts` (new)
Mirrors `app/api/admin/managers/assign/route.ts` step for step, in the same order:
1. resolve team + target profile
2. enforce the 1-week post-sack cooldown (`--override` bypasses, same as the route's `override`)
3. set `teams.manager_id` across every row sharing the club's logo (siblings)
4. close open `manager_tenures` for those rows, then open new ones
5. write an `audit_log` row
6. `reclaimManagerSlots()` — hands the club's own vacant seats, their not-yet-played fixtures and their standings rows to the new manager

It reuses the real `reclaimManagerSlots` from `lib/slot-utils` rather than reimplementing seat logic, and the real `isVacantPlaceholderTeam` guard — the Vacant placeholder is not a real club and is refused, matching the route, which routes that case to `assignVacantSeatToManager` instead.

Env bootstrapping copies `scripts/create-season4.ts`: neither env file carries `NEXT_PUBLIC_SUPABASE_URL`, and the pooler connection string hides the project ref, so the ref is decoded out of the service-role JWT.

Supports `--dry-run`, repeatable `--assign "username:Club Name[:+27 phone]"`, and `--admin <username>` for audit attribution (defaults to the oldest admin).

**`--dry-run` still writes the phone.** That is a real (if minor) wart — the phone update happens before the `dryRun` `continue`. Left as-is because a dry run is a resolution report, not a write report, but the flag name overpromises. Worth tightening if this gets more callers.

### Assignments made
| Club | Manager | Phone |
|---|---|---|
| Lerumo Lions | `dot` | `+27 78 483 1815` |
| Upington City | `karabo_` | `+27 64 935 3180` |

Both clubs had `manager_id = null`, `abandon_count = 0`, and no sibling logo rows, so `allClubIds` was a single row each and no other club was touched. 3 seats reclaimed per manager. Audit attributed to `wandile`.

### Two ambiguities in the request, resolved from data
- **"karabo05" does not exist.** The only candidate is `karabo_` — created 2026-09-28, zero tenures, no phone, no club, i.e. a fresh account waiting for exactly this. Consistent with the trailing-underscore duplicate-account pattern already documented for `Thando`/`thando_1110` and confirmed by `ozilitf`/`ozilitf_`.
- **"Dot" could have been `dot` or `dot7`.** Both are real, active, clubless managers. The supplied phone numbers disambiguated it: `+27 78 483 1815` belongs to `dot`, while `dot7` holds `+27 64 846 3693` and was left alone. `+27 64 935 3180` matched no profile at all, confirming it was the new number for the account that had none.

### `dot`'s stored number was malformed
It was `270784831815` — country code `27` followed by `0784831815`, i.e. a local leading zero left in place. `toInternationalPhone()` (`app/api/webhook/route.ts:1385`) only rewrites numbers that *start* with `0` and are exactly 10 digits, so this passed straight through as `+270784831815` and would have failed the WhatsApp contacts API with error 131009. Now stored correctly as `+27 78 483 1815`.

## Verification
- Both `teams.manager_id` set; `abandon_count` still `0` for both (auto-forfeits correctly never touched it).
- All 6 seats (2 clubs × Motsepe / CAF CL / Nedbank Cup) now carry `user_id`, confirmed by querying participants joined to profiles.
- `sweep_vacant_slots()` returns **0** — auto-loss correctly switched off now that both sides are owned, which is the real proof the widened predicate in `079` keys on ownership and not on a stale list.
- Open tenures present with `ended_at = null`; two `assign_manager` rows in `audit_log`.
- Div 2 league: **16/16** clubs now have a manager (was 14/16). Only 2 managers still lack a phone.
- **No stale auto-forfeits on the remaining fixtures**: of Lerumo/Upington's fixtures, 66 are `scheduled` with `auto_forfeit = 0` (55 Motsepe league, 10 CAF CL group, 1 Nedbank R32), and 3 are `confirmed` with auto-forfeit reasons. The two new managers will actually play their remaining fixtures.
- Standings reconcile: Lerumo Lions and Upington City are each `played 2, W0 D0 L0, pts 0, absent 2, gd_penalty -6` — one void plus one 3-0 absence each, with no W/D/L because the trigger's absence branch books `absent++` + `-3 GD` instead of a loss.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Vacancy fix that left these two seats open: `.opencode/context/user-based-competitions/vacant-sweep-misses-unowned-seats_2026-09-29.md`
- Seat reclaim invoked by the script: `.opencode/context/user-based-competitions/sacked-club-slot-reclaim_2026-09-05.md`
- Slot model: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`
- Phone backfill from the same session: `.opencode/context/check-fixtures/manager-phone-backfill_2026-09-29.md`
- Cooldown semantics: `.opencode/context/onboarding/manager-cooldown-override_2026-08-17.md`
- Tenure handling: `.opencode/context/onboarding/end-all-manager-tenures_2026-08-28.md`
- Route being mirrored: `app/api/admin/managers/assign/route.ts`
- Script: `scripts/assign-manager-to-club.ts`

## Notes / follow-ups
- The two 3-0 forfeits the new managers inherit (`Orbit College 3-0 Lerumo`, `Leicesterford City 3-0 Upington`) were decided by the hourly `sweep_vacant_slots` cron at 2026-09-29T00:00Z, before the seats were filled. Correct under slot-follows-team continuity, but the new managers start a game down — worth mentioning to them.
- **Unrelated but noticed:** `auto-finalise-prev-day` (a Vercel cron, not the sweep) voided three fixtures at 2026-09-29T00:41Z as `'Both teams absent — auto-finalised (0-0, no points)'` — Highbury v Supersport, University of Pretoria v Magesi, The Bees v Gomora United. These are real managers who simply did not submit, and **both sides get nothing**: no points, no goals, just `absent++` and `-3 GD` each. Magesi and The Bees are now bottom of Div 2 on 0 points having played. This is a separate policy question from the vacancy bug and was not changed here.
- The `ILIKE` fix from `080` is load-bearing for those three voids: `'Both teams absent…'` also starts with a capital `B`, so before the fix they would each have been mis-scored as a 3-0 home win.
- `dot7` remains a real, active, clubless manager — there may be a seat for them, or they may be waiting on a reclaim.
