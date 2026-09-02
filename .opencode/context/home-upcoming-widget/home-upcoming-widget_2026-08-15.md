# Upcoming Widget Shows Finished Matches

## Problem
Home page "Upcoming" widget included finished (FT) fixtures — a `confirmed` fixture on the same matchday rendered with a score and "FT" badge, which is wrong for an "Upcoming" list.

## Fix (`app/page.tsx`)
- Removed `'confirmed'` from the batch query status filter (was `['scheduled', 'awaiting_confirmation', 'confirmed']`, now `['scheduled', 'awaiting_confirmation']`). Finished matches no longer appear in "Upcoming".
- The date-gating query already only looked at `scheduled`/`awaiting_confirmation`, so the widget still resolves the correct next matchday.
- Note: the widget's `f.result` access was later changed from array (`?.[0]`) to object access by `.opencode/context/postgrest-embeds/unique-constraint-one-to-one-embed-shape_2026-08-24.md`.

## Related files
- Split from the same original with `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md` (see Restore File Section below).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `.opencode/context/upcoming-and-whatsapp-already-submitted.md` | Split into `ui/home-upcoming-widget.md` (this file) and `whatsapp/already-submitted-handling.md`. | `.recycle/upcoming-and-whatsapp-already-submitted.md` |
