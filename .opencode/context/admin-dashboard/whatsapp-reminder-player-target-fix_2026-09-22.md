# WhatsApp Reminder — Fixed: Reminder Must Go to the Player, Link Points to AI

Follow-up to `.opencode/context/admin-dashboard/whatsapp-reminder-link-session-expiry_2026-09-22.md`. After that change deployed, the admin reported that clicking the H/A WhatsApp button opened/sent the reminder **to the eFootball AI bot** (with the fixture message prefilled) instead of to the player.

## Problem

The H/A WhatsAppButton used the new `overridePhone={AI_BOT_DIGITS}` prop, which redirected the whole `wa.me` link target to the AI number. So the compose box opened on the AI bot with `Hi {name}! ... submit a backdoor here: https://wa.me/27818209406?text=Hi` — the reminder itself went to the bot.

Misunderstanding confirmed by the user: **the reminder message still goes to the player** (admin → manager via H/A button). The **wa.me link inside that message** is what should open the AI bot so the player can submit/backdoor quickly after reading.

## Fix

- `components/ui/DashboardFixtureActions.tsx`: removed `overridePhone={AI_BOT_DIGITS}` from both WhatsAppButtons. Target is back to the manager's own number.
- `components/ui/WhatsAppButton.tsx`: removed the now-unused `overridePhone` prop entirely (component reverted to pre-change behaviour).
- The reminder text is unchanged and still embeds `REMINDER_LINK = https://wa.me/27818209406?text=Hi` (`AI_BOT_DIGITS = '27818209406'` still used to build it) — so the player sees the tap-to-chat link in the message body and tapping it opens the AI chat with `Hi` preloaded, which fires the welcome menu.
- The global 60-min session expiry (`handleExpiredSession` in `app/api/webhook/route.ts`) is unaffected and remains live.

## Notes

- Flow now: admin clicks H/A → WhatsApp opens the player's chat with the slot-tuned reminder prefilled → player receives it → player taps the `wa.me/27818209406?text=Hi` link inside → AI bot opens with `Hi` preloaded → bot shows the welcome menu (any stale session older than 60 min has already been cleared by the expiry rule).
- Verified with `npx tsc --noEmit` (clean). Pushed to `origin/main` with the fix.