# WhatsApp reminder: ET/penalties note only on the deciding leg

## What was done
Follow-up correction to `.opencode/context/admin-dashboard/whatsapp-reminder-round-label-and-et-penalties_2026-11-07.md`: the bold caps ET/penalties line now appears on every single-leg knockout fixture but ONLY on leg 2 of a two-legged tie. Leg-1 reminders no longer tell managers to switch on extra time and penalties.

## Problem
The first version added `⚠️ *DON'T FORGET TO TURN ON EXTRA TIME AND PENALTIES.*` to every knockout reminder, including leg 1 of two-legged rounds. Users reported that this is wrong: a two-legged tie cannot be decided by a shootout in leg 1 — penalties belong to leg 2 only. Printing the note on leg 1 implied the wrong rules and could push managers into an unnecessary shootout.

## Fix
`components/ui/DashboardFixtureActions.tsx` — `buildReminder()` now gates the note on both the round and the leg:

```ts
const isKnockoutRound = !!(roundType && REMINDER_ROUND_LABELS[roundType])
const decidesOnPens = !twoLegRound || (leg ?? 1) === 2
if (isKnockoutRound && decidesOnPens) {
  lines.push(`⚠️ *DON'T FORGET TO TURN ON EXTRA TIME AND PENALTIES.*`)
}
```

Result:
- Single-leg knockout round (`twoLegRound = false`): note on the only game (e.g. Nedbank Cup `(SF)`).
- Two-legged round (`twoLegRound = true`): note on `(QF Leg 2)`, `(SF Leg 2)`, `(Final Leg 2)` only; `(QF Leg 1)` / `(SF Leg 1)` get no note.
- League/group: still no note.

`twoLegRound` comes from the dashboard page's `twoLegRounds` set (tournament + round with a `leg = 2` fixture), so it reflects the real bracket, not an assumption.

## Verification
- `npx tsc --noEmit` clean.
- Manual trace: CAF Confed SF leg 1 (`twoLegRound = true`, leg 1) → no note; CAF Champions League QF leg 2 (`twoLegRound = true`, leg 2) → note; Nedbank Cup SF (`twoLegRound = false`, leg 1) → note.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Original note/template change this corrects: `.opencode/context/admin-dashboard/whatsapp-reminder-round-label-and-et-penalties_2026-11-07.md`
- Round suffix / two-leg detection details: same file
- Reminder short backdoor link (same template): `.opencode/context/admin-dashboard/whatsapp-reminder-short-backdoor-link_2026-11-07.md`
