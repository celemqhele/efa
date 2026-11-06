# WhatsApp reminder: knockout round label and ET/penalties warning

## What was done
The admin dashboard WhatsApp reminder now names the knockout round when a tie is single-leg (`(SF)`, `(QF)`, `(Round of 16)`, `(Round of 32)`, `(Final)`) instead of printing `(Leg 1)`, keeps the leg number only for genuine two-legged rounds (`(QF Leg 2)`), drops the leg suffix entirely for league/group fixtures, and adds a bold caps line telling managers to enable extra time and penalties in eFootball.

## Problem
Follow-up to `.opencode/context/admin-dashboard/whatsapp-reminder-add-tournament-and-leg_2026-11-04.md` and `.opencode/context/admin-dashboard/whatsapp-reminder-show-leg-always_2026-11-04.md`, which made the template append `(Leg N)` whenever `leg` was present. Two problems surfaced:

1. `fixtures.leg` is populated for league and group fixtures too (it marks the season half), so every league reminder showed `(Leg 1)` or `(Leg 2)`. Users reported this reads as though a second leg is coming.
2. Single-leg knockout rounds (e.g. the Nedbank Cup semi-finals, and the 32-team R32) also store `leg = 1` with no leg-2 fixture. Printing `(Leg 1)` there made managers expect a second leg that does not exist. The reminder never named the round, so `SF`/`QF`/`Round of 16` was lost.
3. Knockout reminders did not remind managers to switch on extra time and penalties in eFootball, which the league needs to settle level cup games.

## Fix
- `app/(admin)/admin/dashboard/page.tsx`: the all-fixtures query now selects `leg`; builds a `twoLegRounds` set keyed `tournament_id:round_type` whenever a `leg >= 2` fixture exists; the due-fixtures select includes `tournament_id`; each due fixture gets `_twoLeg` from that set.
- `app/(admin)/admin/dashboard/_desktop.tsx` / `_mobile.tsx`: pass `roundType={fx.round_type}` and `twoLegRound={!!fx._twoLeg}` to `DashboardFixtureActions`.
- `components/ui/DashboardFixtureActions.tsx`:
  - new `REMINDER_ROUND_LABELS` (`r32` → Round of 32, `r16` → Round of 16, `qf` → QF, `sf` → SF, `final`, `third`, `super_cup`) and `roundSuffix()`.
  - `roundSuffix()` returns nothing for `league`/`group`, `" (SF)"` style for single-leg knockout rounds, and `" (QF Leg 2)"` when `twoLegRound` is true.
  - `buildReminder()` appends the suffix to the `⚽ home vs away` line.
  - Knockout rounds (any `roundType` in `REMINDER_ROUND_LABELS`) get the extra bold caps line `⚠️ *DON'T FORGET TO TURN ON EXTRA TIME AND PENALTIES.*`.

Example reminder for the Nedbank Cup semi-final (single leg):
```
👋 Hi AmaZulu
🏆 Nedbank Cup
⚽ AmaZulu vs Upington City (SF)
⚠️ *DON'T FORGET TO TURN ON EXTRA TIME AND PENALTIES.*
📞 *MESSAGE YOUR OPPONENT: +27 ...*
🏟️ *HOME TEAM: CREATE THE MATCHROOM ...*
```

## Verification
- `npx tsc --noEmit` clean.
- `npx next lint` on the changed files: only pre-existing unused-variable warnings (`roundType`/`leg` inside `ResultPanel`, unrelated).
- Data checked against Supabase: CAF Champions League QF leg 2 and CAF Confed SF leg 1 both have a `leg = 2` sibling → `(QF Leg 2)` / `(SF Leg 1)`; Nedbank Cup SF has no leg-2 sibling → `(SF)`; league/group have `leg` 1/2 but are not in the label map → no suffix.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Previous leg/tournament template work: `.opencode/context/admin-dashboard/whatsapp-reminder-add-tournament-and-leg_2026-11-04.md`
- Previous "always show leg" change this amends: `.opencode/context/admin-dashboard/whatsapp-reminder-show-leg-always_2026-11-04.md`
- Compact/emoji-led template style: `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`
- Knockout round metadata module: `lib/tournament-rounds.ts`
