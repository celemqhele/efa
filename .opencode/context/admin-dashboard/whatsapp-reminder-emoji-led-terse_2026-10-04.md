# Emoji-led, shorter-link WhatsApp reminder (decongestion follow-up)

Follow-up to `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`. After that compact six-line template shipped, the user pasted a live reminder and said it was **still too congested**, and asked for an emoji on each point. This strips the labels down to one or two words, leads every line with an emoji, and drops the `Hi ` from both link prefills.

## Problem

The first compact template was correct structurally (one item per line) but still read as a wall: every line began with a long label ("Matches due:", "Their number:", "Report them not responding:") and the two `wa.me` URLs were ~50-56 characters each because the prefill wasted 6 characters on a `Hi ` greeting the bot never needed. With labels plus URLs, the two link lines ran ~78 characters and wrapped over three phone lines each.

## Fix

`components/ui/DashboardFixtureActions.tsx` only — no webhook or DB change needed.

New body (`buildReminder`), emoji-led with minimal labels:

```
👋 Hi Terrence
⚽ Siwelele vs Stellenbosch
📞 +27 67 8721810
✅ Submit: https://wa.me/27818209406?text=MC-Q9DUM5HF
🚨 Report them: https://wa.me/27818209406?text=BQH%20MC-Q9DUM5HF
⚠️ *WHEN CLICKING LINK JUST HIT SEND, DON'T EDIT TEXT*
```

- Emoji per point: 👋 greeting, ⚽ fixture, 📞 opponent number, ✅ submit, 🚨 report, ⚠️ instruction line. Dropped the "Matches due:" and "Their number:" labels — the emoji carries the meaning and the bot's own reply repeats the fixture name anyway.
- Labels shortened to `Submit:` and `Report them:`.
- Both prefills lost their `Hi `: the deep-link handler matches the codes anywhere in the message and runs before the session is read (`app/api/webhook/route.ts` `handleMatchCentreLink` / `BQH_TOKEN_RE`), so the greeting was dead weight. Prefill is now `MC-<CODE>` and `BQH MC-<CODE>`.
- `https://` deliberately **kept** on the links — dropping the scheme would save 8 more characters but risks WhatsApp not linkifying `wa.me/...`, and a non-clickable link would break the whole "just hit send" instruction.
- Message length: 330 → **232** characters; longest line 78 → **64**.

## Verification

- `npx tsc --noEmit` clean, `npx next lint` clean for the touched file, `npx next build` succeeds.
- Rendered the exact output through tsx with `formatPhoneDisplay('27678721810')` to confirm the six lines, the encoded space in the BQH prefill (`BQH%20MC-…`) and the asterisk bold line.
- Live WhatsApp check of the shorter prefills still pending on deploy (routing is unchanged: code-only text hits the same deep-link branch).

## Gotchas / Notes

- A code-only prefill means the manager's chat shows the raw code next to the link preview. Harmless, and it is what makes the message shorter.
- `FALLBACK_REMINDER_LINK` still uses `?text=Hi` — that path only fires while a fixture's code is loading, and `Hi` is what lands on the welcome menu.

## Cross-references

- The template this decongests: `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`
- Earlier reminder chain: `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md`,
  `.opencode/context/admin-dashboard/whatsapp-reminder-link-session-expiry_2026-09-22.md`
- Deep links / codes: `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`
- Number formatting: `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md` (`formatPhoneDisplay` in `lib/phone.ts`)

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |