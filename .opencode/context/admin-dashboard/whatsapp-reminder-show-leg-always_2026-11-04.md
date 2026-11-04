# WhatsApp reminder template: always show the leg number

## What was done
Changed the leg display condition in `components/ui/DashboardFixtureActions.tsx` from `leg > 1` to `leg != null`, so the reminder now always states which leg the fixture is (e.g. `(Leg 1)`), not only second legs.

## Problem
After adding the leg to the template, the condition `leg && leg > 1` hid the leg for first-leg fixtures. For a knockout tie's first leg (leg = 1) the reminder still did not say which leg it was, which is what the user reported.

## Fix
- `buildReminder`: matchup line now appends `(Leg ${leg})` whenever `leg` is not null/undefined.