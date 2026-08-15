# WhatsApp Backdoor Admin Override

## Problem
Admins could only apply backdoors ("backdoor admin" command) to fixtures that were still `scheduled` within the ±7 day window. Once a fixture was confirmed via backdoor (or a wrong date pushed it outside the window), it could never be found again — so a wrong result/date could not be corrected.

## Fix (`app/api/webhook/route.ts`)

### Broadened search (`handleBackdoorSearch`)
- Now selects `results!results_fixture_id_fkey(home_score, away_score)` alongside the team/tournament fields.
- Searches `status IN ('scheduled','confirmed','awaiting_confirmation','completed','abandoned')` — no longer only `scheduled`.
- Removed the `getWeekRange()` date filter so fixtures on wrong dates are findable (any date, any status).
- List uses the same naming as the screenshot result-submit route: `formatFixtureListWithHeadings()` → `1. Home vs Away - {date} - {tournament} (Pending)` / `(... Submitted, 3-0)`.
- `displayed_fixtures` is stored as `sortFixturesForDisplay(matched).map(f => f.id)` so the numbered indices match the rendered list (identical date sort).

### Override prompt (`handleBackdoorFixture` + new `handleBackdoorOverrideConfirm`)
- When an admin picks a fixture that already has a result (`confirmed` / `awaiting_confirmation` / `completed`), the bot replies:
  `This match has already been applied backdoor (Result: {home} {hs}-{as} {away}). Would you like to override and correct? Reply YES or NO.`
  and sets session `state='awaiting_backdoor_override_confirm'` (plain text, no migration).
- New state handler:
  - YES → `state='awaiting_backdoor_side'`, asks `Who gets the 3-0 win? Reply "home" or "away".`
  - NO → clears session, `OK. No changes made.`
  - CANCEL → clears session, `Cancelled.`
  - anything else → re-prompts `Reply YES or NO.`

### Override-safe submit (`handleBackdoorSide`)
- Before writing, detects an existing result; if overriding, sets `results.override_reason = 'backdoor override'` on the upsert.
- Calls `recalculateStandings(tournament_id)` after the update (same as the admin review decision path) so overridden stats are corrected.

## Status
- `npx tsc --noEmit` passes; `next lint` clean for `route.ts`.
- Session state is a plain text column on `whatsapp_sessions` — no schema change needed.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
