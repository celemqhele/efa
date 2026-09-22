# Backdoor "No match found" fix for knockout fixtures (already-processed matches now surfaced)

## Problem
During the EFA International Cup knockout stage, a manager reported "No match found for that" when typing "Egypt vs South Korea" in the opponent-not-responding backdoor flow (welcome menu option 2 → screenshot → fixture search). The fixture exists and is findable by both team names — but it had already been settled (R16 knockout, `status='confirmed'`, result "South Korea absent — forfeit (3–0)").

Root cause: `handleBackdoorFixtureSearch` in `app/api/webhook/route.ts` only queried `.eq('status', 'scheduled')` within the current ±7-day week window. Any fixture that moved off `scheduled` (confirmed / confirmed_pending / awaiting_confirmation / completed / abandoned) was invisible to the flow, so it responded with the dead-end "No match found for that" instead of surfacing the existing result. Knockout rounds magnify this because a large share of ties become `confirmed` immediately (5 of 8 R16 fixtures were already confirmed).

A second, related trap: `handleBackdoorSideSelect` hard-blocked any non-`scheduled` fixture with the vaguer "This fixture is no longer available for backdoor", so even once found, an already-processed knockout fixture would dead-end again.

## Fix
`app/api/webhook/route.ts`, backdoor flow only:

1. **Widened the search status filter** in `handleBackdoorFixtureSearch` from `.eq('status', 'scheduled')` to `.in('status', ['scheduled', 'confirmed', 'confirmed_pending', 'awaiting_confirmation', 'completed', 'abandoned'])`, and added the `results!results_fixture_id_fkey(home_score, away_score, override_reason)` embed so the found fixture carries its result.
2. **Admin window bypass** mirroring the main result-submission flow (which already bypasses the date window for admins at `route.ts:3316`): non-admins stay limited to the ±7-day `getWeekRange()` window; admins (`isAdminPhone`) may search any date.
3. **Single-match branch intercepts non-scheduled fixtures**: if the one matched fixture's status is not `scheduled`, reply `This match has already been processed: Egypt 3-0 South Korea (South Korea absent — forfeit (3–0))` (+ date line), clear the session, and stop — instead of steering the user to the "who is not responding?" step.
4. **Side-select gate now surfaces the result**: the final "fixture no longer scheduled" guard in `handleBackdoorSideSelect` now also loads the `results` embed and reports the existing score + `override_reason` (falling back to the old message when no result exists). Covers a non-scheduled fixture picked from a multi-match list.

The main result-submission flow already solved the same UX problem (`submission_type === 'fix'` filter + the "This match has already been submitted — Would you like to edit it?" fallback at `route.ts:3352`); this change brings the backdoor flow in line with it, per user direction ("isn't this already solved... ").

## Verification
- Fixture `03f53bc3-9b53-4d35-821c-b90e55040945` (Egypt vs South Korea, R16, EFA International Cup, 2026-09-21) is `confirmed` with result id `166de9f6-70b4-494e-90c0-f86ccc9f948b` (3–0, `override_reason='South Korea absent — forfeit (3–0)'`).
- `npx tsc --noEmit` clean; `next lint` shows only pre-existing warnings (no new ones).

## Related files
- `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md` — admin backdoor override mechanism.
- `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md` — the main flow's already-submitted fallback this fix mirrors.
- `.opencode/context/postgrest-embeds/unique-constraint-one-to-one-embed-shape_2026-08-24.md` — result embed shape used above.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |