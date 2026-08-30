# Vacant slot: display restamp + auto-forfeit pending results

## Intro
Follow-up to the slot model in `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`: the user asked what a vacant team shows in standings and fixtures (and whether it uses the lucide/react ShieldQuestion logo). That exposed that `vacateUserSlots` only cleared ownership — the seat kept the departed club's *name* everywhere because standings/group-standings rows and fixture team_id copies were never restamped. The user then asked that a vacated seat's remaining fixtures forfeit immediately via the existing `confirmed_pending` status: 3-0 to the opponent, or 0-0 void when both sides are vacant, flipping to `confirmed` on the fixture's scheduled date.

## Problem
- **Stale team references**: `vacateUserSlots` set `tournament_participants.user_id = null` + `team_id = Vacant` but never touched `standings`/`group_standings.team_id` or `fixtures.home/away_team_id`. Pages render those `team_id` copies, so a sacked seat kept showing the old club name until `fillVacantSlot` or a recalc rewrote them. The vacancy was only visible via `participants.user_id`.
- **No immediate forfeit**: only the hourly `sweep_vacant_slots()` (migration 067) auto-decided *past-due* scheduled fixtures; future fixtures of a vacant seat stayed `scheduled` until they went overdue, and could only be processed by the sweep after the date passed.
- **History rewrite on refill**: `fillVacantSlot` restamped *all* of the slot's fixtures (including already-played/confirmed ones), so taking over a seat rewrote the departed manager's historical matchups.
- **Sweep blind spot**: because vacate never stamped fixture team_ids to the Vacant row, the 067 sweep's `home/away_team_id = vacant` filter could not even see a newly-vacated seat's fixtures until a recalc/fill restamped them.

## Fix (all in `lib/slot-utils.ts`)
- **`vacateUserSlots` restamps display refs**: for each vacated slot it now sets `standings` and `group_standings` `team_id` → Vacant (points/form untouched, seat continuity preserved) and restamps not-yet-played fixtures (`scheduled`, `awaiting_confirmation`, `confirmed_pending`) sides → Vacant. Played (confirmed) fixtures keep the club that actually played so history stays intact.
- **Auto-forfeit pending results** at vacate time: for each vacated slot, league/group fixtures (`round_type IN ('league','group')`, `scheduled_date NOT NULL`, status `scheduled` or `confirmed_pending`, and no human result) get a `results` row via upsert on `fixture_id`:
  - Vacant home → 0-3, Vacant away → 3-0 (`'Vacant slot absent — automatic 0-3'` / `'…3-0'`); both sides vacant → 0-0 void (`'Both slots vacant and absent — void (0-0)'`). All written `is_abandoned = false`, `finalised_by = null`, mirroring the sweep's insert pattern from `supabase/migrations/067_vacant_sweep.sql` so the trigger's `'%absent%'`/`'%both%'` outcome paths apply and the Vacant placeholder never accrues `abandon_count`.
- **Reuses the existing pending machinery, nothing else to build**: `update_standings_after_result()` (migration 066) guards future-dated inserts (`scheduled_date::date > CURRENT_DATE`) by setting `status = confirmed_pending` and skipping standings; the daily `app/api/cron/flip-pending/route.ts` flips due `confirmed_pending` → `confirmed`, recalculates standings and advances KO. On the fixture's day the forfeit becomes confirmed exactly as the user asked.
- **Later vacancy of the opponent upgrades 0-3 → 0-0**: the upsert reaches `confirmed_pending` auto-results too, so if the other side is vacated afterwards, the mutual fixture is recomputed to the void 0-0 on the shelf and stays pending until its day. Human-entered results (`finalised_by` set) are never overwritten.
- **`fillVacantSlot` no longer rewrites history**: its fixture restamp now also filters to `pendingStatuses`, so a new owner's club applies only to not-yet-played fixtures; standings/group standings still flip to the new club (slot-follows-team).
- Vacant side renders as **"Vacant"** + lucide **ShieldQuestion** via the `custom/vacant` placeholder added in `components/ui/TeamLogo.tsx` (from `user-slots-model_2026-08-30.md`).
- Neither sack caller changed: `checkAndAutoSack` (`app/api/admin/finalise-result/route.ts`) and `app/api/admin/managers/sack/route.ts` already call `vacateUserSlots`, so both inherit the restamp + auto-forfeit.
- The 067 hourly sweep stays as a backstop for seats vacated by older paths; it is mutually exclusive with the new behavior (it only targets `scheduled` fixtures with no result, while vacate-time results are `confirmed_pending`/`confirmed`).

## Verification
- `npx tsc --noEmit`: clean. `npm run lint`: no new warnings (only pre-existing ones in unrelated files). `npm run build`: succeeds.
- Live query mirroring the function's fixture filter (Vacant placeholder `820ea628-d202-473d-8d75-62cac670f135`): **0** fixtures would be auto-pended right now — every International Cup seat is currently owned, so nothing to process.
- Insert path intentionally mirrors the live-proven `sweep_vacant_slots()` insert + trigger flow.

## Restore File Section
- (none — no scripts created or recycled this change)

## Cross-references
- Slot model this is a follow-up to: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`
- Sweep cron this now coexists with: `supabase/migrations/067_vacant_sweep.sql` (in the slot-model file)
- Confirmed-pending result flow (WhatsApp future-dated submissions) reusing the same status: `.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md`

## Notes / follow-ups
- KO-round fixtures of a vacant slot are intentionally untouched (matches the sweep precedent — empty-best won't fast-play knockouts); vacant KO legs still handled via fixture management / progression, which decides with `advanceWinner` rather than an auto result.
- `awaiting_confirmation` fixtures are restamped for display but not auto-forfeited (they already have manager-confirmed scores waiting on the confirm path).