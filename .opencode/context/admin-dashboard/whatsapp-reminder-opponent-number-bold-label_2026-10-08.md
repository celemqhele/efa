# WhatsApp reminder: bolded "MESSAGE YOUR OPPONENT" number label

Follow-up in the reminder chain (see `.opencode/context/admin-dashboard/whatsapp-reminder-emoji-led-terse_2026-10-04.md`). Managers who received the emoji-led reminder still asked for the opponent's number — the bare `📞 +27 XX XXXXXXX` line didn't read as the number to message — so the line now carries a bold label.

## Problem

The 📞 line in `buildReminder` (`components/ui/DashboardFixtureActions.tsx`) was just the formatted number with no label. Managers didn't realise it was the opponent's number and kept asking for it, despite it being in the template.

## Fix

Single change in `components/ui/DashboardFixtureActions.tsx` `buildReminder`:

```
📞 *MESSAGE YOUR OPPONENT: +27 78 8707749*
```

- Bold is WhatsApp's single-asterisk form, matching the existing `*WHEN CLICKING LINK JUST HIT SEND…*` style (that line was dropped in the portal-link redesign, but the `*bold*` convention is what WhatsApp renders as bold).
- Keeps the existing fallback text `not available` when the opponent has no phone.
- No template duplication — this is the only reminder template (verified: only `DashboardFixtureActions.tsx` builds reminder text; the webhook 774 match was a "when" false positive).

## Verification

- Rendered via `npx tsx`: `📞 *MESSAGE YOUR OPPONENT: +27 78 8707749*`.
- `npx tsc --noEmit` clean; `npx next lint --file components/ui/DashboardFixtureActions.tsx` clean.

## Files touched

- `components/ui/DashboardFixtureActions.tsx` — 📞 line now `📞 *MESSAGE YOUR OPPONENT: ${theirNumber}*`; comment updated.

## Cross-references

- `.opencode/context/admin-dashboard/whatsapp-reminder-emoji-led-terse_2026-10-04.md`
- `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |