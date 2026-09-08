# Time-Based WhatsApp Reminder Templates (Admin Dashboard)

Replaced the hard-coded fixture reminder message on the admin dashboard WhatsApp buttons with time-of-day-aware templates. When the admin clicks the H/A WhatsApp icon in the "Fixtures Due" section, the pre-filled message now changes depending on the current SAST time (UTC+2).

## Problem

The WhatsApp reminder template was hard-coded in `components/ui/DashboardFixtureActions.tsx`:

> "Hi {name}! Just a reminder that your fixture vs {opponent} is scheduled for today. Please submit your result after playing."

It never changed during the day, so late-evening reminders read the same as early-morning ones even when the fixture was approaching dead-line / backdoor risk.

## Fix

Edited `components/ui/DashboardFixtureActions.tsx`:

- Added a `getTimeSlot()` helper that returns the SAST hour slot (`morning`, `afternoon`, `evening`, `night`) using `getUTCHours() + 2` wrapped to 24h.
- Added a `buildReminder(name, opponent, slot)` helper that returns one of four templates:
  - **morning (06h–11h59):** "Hi {name}! Just a reminder that your fixture vs {opponent} is scheduled for today. Please submit your result after playing."
  - **afternoon (12h–17h59):** "Hi {name}! Friendly reminder — your fixture vs {opponent} is today. Your opponent might have forgotten, so please reach out and arrange to play."
  - **evening (18h–20h59):** "Hi {name}! Your fixture vs {opponent} is still pending. If your opponent is not responding, send a message to the AI here +27 81 8209406"
  - **night (21h–05h59):** "Hi {name}! Your result for the fixture vs {opponent} is still not submitted. Please play or risk a backdoor loss. If your opponent is not responding, now's a good time to submit a backdoor — send it here +27 81 8209406"
- `homeMsg`/`awayMsg` now call `buildReminder` with the current `timeSlot` — time-based templates override ALL statuses, including `awaiting_confirmation` (previously a separate "Please confirm the result" message).
- Added a small uppercase slot label (`Morning`/`Afternoon`/`Evening`/`Night`) next to the WhatsApp buttons so the admin knows which template is active.

The AI backdoor number is written in `+27 81 8209406` format (with spaces omitted) so WhatsApp turns it into a clickable link.

## Notes

- Client component so `new Date()` runs in the admin's browser; timezone is fixed to SAST (UTC+2) regardless of device timezone.
- Submit/Finalise button behaviour (`isAwaiting`) is unchanged.
- Verified with `npx tsc --noEmit` and `npx next lint` (no errors/warnings introduced).