# WhatsApp Reminder Link + Global Session Expiry

Follow-up to the time-based reminder templates in `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md` (and the night-slot fix in `.opencode/context/admin-dashboard/time-based-whatsapp-reminders-5am-night-fix_2026-09-09.md`). The admin reported managers were unsure how to use the raw AI number (`+27 81 8209406`) written into the evening/night reminder templates, and that a preloaded greeting could collide with an existing open session.

## Problem

1. The reminder templates in `components/ui/DashboardFixtureActions.tsx:48,50` referenced the AI backdoor bot as a bare number — people didn't know what to do with it.
2. Clicking a reminder link pushes a preloaded `Hi` into the manager's WhatsApp input. If that manager was mid-flow (score loaded, backdoor pending), the message hit a stale session state instead of a clean welcome, so a random `Hi` was answered wrong.

## Fix

**1. Reminder link (components/ui/DashboardFixtureActions.tsx + components/ui/WhatsAppButton.tsx)**

- Added `AI_BOT_DIGITS = '27818209406'` and `REMINDER_LINK = https://wa.me/27818209406?text=Hi` (GA text = `Hi`, so the bot lands on the fresh welcome menu).
- All four `buildReminder` slots now close with the link instead of the raw number, and the morning/afternoon slots were updated per the user's request ("if you already played submit the score here"):
  - morning: "…If you already played, submit the score here: {link}"
  - afternoon: "…If you already played, submit the score here: {link}. If your opponent is not responding, report a backdoor win: {link}"
  - evening: "…If your opponent is not responding, report them to the AI here: {link}"
  - night: "…submit a backdoor here: {link}"
  - The old raw number appears nowhere else in the repo (only the previous context files).
- Removed the em-dash phrasing from the afternoon/night templates per the banter/typography rules.
- `WhatsAppButton` got an optional `overridePhone` prop: when set, the `wa.me` link targets that number instead of the manager's own. The dashboard passes `overridePhone={AI_BOT_DIGITS}` so the prefilled reminder (which also contains the link as text) opens on the AI bot.

**2. Global 60-min session expiry (app/api/webhook/route.ts)**

- `whatsapp_sessions` already tracked `updated_at` (migration `034_whatsapp_sessions.sql`) and `upsertSession` stamps it on every state change, so the idle window is measured from last activity. No schema change.
- New `SESSION_MAX_IDLE_MS = 60 * 60 * 1000` and `handleExpiredSession(phoneNumber, session)` which deletes the row when `now - updated_at > 60 min` and returns a boolean (whether it cleared).
- Applied at BOTH message entry points, before any state logic:
  - `handleText` (after `getSession`): an expired session skips all mid-flow handlers and is routed straight to `handleWelcomeMenu`, so any message — including the reminder link's `Hi` — restarts at the clean welcome menu.
  - Image-message branch in `POST`: the stale session is cleared, the session is re-read (now absent), so a late screenshot skips the dead `awaiting_backdoor` path and falls through to normal image/OCR handling instead of being swallowed.
- `handleWelcomeMenu`'s comment updated to note it also serves freshly-expired sessions.
- NOTE: this expiry is GLOBAL (per the user's decision) — every session, whether reminder-started or not, resets to the welcome menu after an hour of silence. No "session expired" note is added (user chose just the welcome menu).

## Notes

- `SessionData` gained optional `created_at`/`updated_at` fields so `handleExpiredSession` can read them through TypeScript without casting.
- Time-slot windows were left untouched (still the midnight-reset scheme from the 5am fix).
- Verified with `npx tsc --noEmit` (clean) and `npx next lint` (only pre-existing warnings elsewhere; nothing new in the three touched files).