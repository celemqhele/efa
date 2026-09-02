# WhatsApp Already-Submitted Handling

## Problem
On WhatsApp, a user who submitted a screenshot, chose option 1 (first-time submission), then typed a fixture that was already submitted got "No fixtures found matching ..." — misleading and made the bot look broken.

## Fix (`app/api/webhook/route.ts`)
- New session state `awaiting_already_submitted` (plain text on the existing `whatsapp_sessions.state` column, no migration).
- In the `awaiting_match_name` block, when `submission_type === 'new'` and the `['scheduled']` search finds nothing, a second query looks up the same team pair with statuses `['confirmed', 'awaiting_confirmation', 'completed', 'abandoned']` (embedded `results(home_score, away_score, match_stats(*))`). If found, it takes the **most recent** fixture and replies:
  "This match has already been submitted. Here are the results and stats: ... Would you like to edit it? Reply YES or NO."
  Sets state to `awaiting_already_submitted`.
- New state handler (before the affirmative "direct bypass"):
  - YES → clear session + "Send a new screenshot and choose option 2 (Changing a score that was already submitted)."
  - NO → clear session + "If you need to submit a new match, send a new screenshot and let me know."
  - CANCEL → clear session + "No stress. Send a new screenshot when you're ready."
  - other → re-prompt "Reply YES or NO."
- Added `dbStatsToSessionFormat()` helper that converts a `match_stats` DB row (`home_possession`/`away_possession`/etc.) back to the `{ possession: { home, away }, ... }` shape so `formatStatsBlock` renders the stored stats.

## Related files
- Split from the same original with `.opencode/context/home-upcoming-widget/home-upcoming-widget_2026-08-15.md` (see Restore File Section below).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `.opencode/context/upcoming-and-whatsapp-already-submitted.md` | Split into `ui/home-upcoming-widget.md` and `whatsapp/already-submitted-handling.md` (this file). | `.recycle/upcoming-and-whatsapp-already-submitted.md` |
