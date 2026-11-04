# WhatsApp reminder template: add tournament name and leg

## What was done
Added the tournament name and the leg number to the admin dashboard WhatsApp reminder template in `components/ui/DashboardFixtureActions.tsx`, and threaded `tournament`/`leg` through the dashboard due-fixtures query and both `_desktop`/`_mobile` callers.

## Problem
The reminder template read:
```
👋 Hi {name}
⚽ {home} vs {away}
📞 MESSAGE YOUR OPPONENT: ...
🏟️ ... Submit here: ...
```
It omitted the tournament name and which leg of a two-legged tie the fixture belonged to, so managers could not tell which competition/round the reminder referred to.

## Fix
- `app/(admin)/admin/dashboard/page.tsx`: due-fixtures select now includes `round_type, leg, tournament:tournaments(id, name, type)`.
- `_desktop.tsx` / `_mobile.tsx`: pass `tournamentName={fx.tournament?.name ?? null}` and `leg={fx.leg ?? null}` to `DashboardFixtureActions`.
- `DashboardFixtureActions.tsx`: new `tournamentName` and `leg` props; `buildReminder` now emits `🏆 {tournamentName}` when present and appends ` (Leg {leg})` to the matchup line when `leg > 1`.