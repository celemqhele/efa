# Upcoming Widget Shows Finished Matches

## Problem
Home page "Upcoming" widget included finished (FT) fixtures — a `confirmed` fixture on the same matchday rendered with a score and "FT" badge, which is wrong for an "Upcoming" list.

## Fix (`app/page.tsx`)
- Removed `'confirmed'` from the batch query status filter (was `['scheduled', 'awaiting_confirmation', 'confirmed']`, now `['scheduled', 'awaiting_confirmation']`). Finished matches no longer appear in "Upcoming".
- The date-gating query already only looked at `scheduled`/`awaiting_confirmation`, so the widget still resolves the correct next matchday.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `.opencode/context/upcoming-and-whatsapp-already-submitted.md` | Split into `ui/home-upcoming-widget.md` (this file) and `whatsapp/already-submitted-handling.md`. | `.recycle/upcoming-and-whatsapp-already-submitted.md` |
