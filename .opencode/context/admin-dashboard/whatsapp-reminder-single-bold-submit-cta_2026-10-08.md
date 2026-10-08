# WhatsApp reminder: single link + bold "Submit for this match" CTA

Follow-up in the reminder chain (see `.opencode/context/admin-dashboard/whatsapp-reminder-opponent-number-bold-label_2026-10-08.md`). The previous reminder still carried two links (Submit + Report them). The user asked for exactly one link with a bold "Submit for this match" CTA.

## Problem

Two `wa.me`/portal links in one message split the manager's attention and the reminder no longer had a single decisive action. The backdoor link was rarely the point of a match-due nudge anyway.

## Fix

`components/ui/DashboardFixtureActions.tsx`:
- `buildReminder` drops the `reportLink` param and the `🚨 Report them:` line entirely.
- The Submit line is now the bold CTA:
  ```
  ✅ *Submit for this match: https://efa-fxyk.vercel.app/submit-match/MC-…*
  ```
- Callers (`homeMsg` / `awayMsg`) no longer pass `reportLink`; the `backdoorLink` const is removed. The backdoor path remains reachable via the portal URL's `?action=backdoor`, just no longer advertised in reminders.

Final template:

```
👋 Hi Terrence
⚽ Siwelele vs Stellenbosch
📞 *MESSAGE YOUR OPPONENT: +27 78 8707749*
✅ *Submit for this match: https://efa-fxyk.vercel.app/submit-match/MC-…*
```

## Verification

- Rendered via `npx tsx` — confirmed the four lines above.
- `npx tsc --noEmit` clean; `npx next lint --file components/ui/DashboardFixtureActions.tsx` clean.

## Files touched

- `components/ui/DashboardFixtureActions.tsx` — removed reportLink from params/callers, one bold Submit CTA.

## Cross-references

- `.opencode/context/admin-dashboard/whatsapp-reminder-opponent-number-bold-label_2026-10-08.md`
- `.opencode/context/admin-dashboard/whatsapp-reminder-emoji-led-terse_2026-10-04.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |