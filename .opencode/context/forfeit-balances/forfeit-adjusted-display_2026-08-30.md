# Forfeit "adjusted from x-x" shown on fixture & result pages (30 Aug)

Added the pre-penalty ("adjusted from x-x") score line to forfeit matches on both
the public fixture detail page (`/fixtures/[id]`) and result detail page
(`/results/[id]`), and fixed a long-standing bug where those pages showed the
**final post-penalty** score as the "Score at time". This builds on the forfeit
+3 penalty work first described in
`.opencode/context/forfeit-balances/forfeit-balance-use-fix_2026-08-16.md` and the
metadata the WhatsApp forfeit path has been writing.

## Problem

For an abandoned/forfeit match the two detail pages rendered a ForfeitBadge
with `... forfeited. Score at time: ${result.home_score}-${result.away_score} ...` —
but `result.home_score`/`away_score` already include the +3 penalty, so "Score at
time" showed the wrong, post-penalty number. The real pre-penalty score was only
available, when at all, inside `forfeit_balances.half_time_note`.

## Data reality check

Prefixed the change with a DB audit. Of 40 abandoned matches:

- Only **19** have a `half_time_note` containing `(adjusted from X-Y)` — these are
  forfeits submitted through the WhatsApp/webhook path (e.g. `Forfeit: 6-2
  (adjusted from 3-2)`).
- **24** do not: the older admin-website path writes `Forfeit: TeamA vs TeamB — X-Y (HT)`
  with no pre-penalty info, and a few matches have no `forfeit_balances` row at all.

## Decision (user)

Show the "adjusted from x-x" line **only where the metadata exists** — do not
derive +3 for the older matches (avoids incorrect values if a past forfeit didn't
actually add a penalty).

## Fix

- `lib/forfeit-note.ts` (new): `parseForfeitAdjusted(note)` — regex-parses
  `adjusted from X-Y` (accepting `-`, `–`, `—`) out of a `half_time_note` and
  returns `{ home, away }` or `null`. Only shared parsing helper for both pages.
- `app/(public)/fixtures/[id]/page.tsx`: when `result.is_abandoned`, fetch
  `forfeit_balances(half_time_note)` by `fixture_id`, take the first row that
  parses into an adjusted score, and pass it through as `adjustedScore`.
- `app/(public)/results/[id]/page.tsx`: same fetch keyed off the result's
  `fixture.id`, passes `adjustedScore`.
- `app/(public)/fixtures/[id]/_desktop.tsx` & `_mobile.tsx`: destructure
  `adjustedScore` and use it for "Score at time" when present, else fall back to
  the previous final-score text.
- `app/(public)/results/[id]/_desktop.tsx` & `_mobile.tsx`: same change.

## Notes / Gotchas

- The `(HT)` older forfeits and `null`-note matches intentionally keep their old
  behaviour (no pre-penalty line) per the coverage decision. If those are later
  wanted we'd have to derive +3 from the final score, which is out of scope.
- No DB migration; this is a read-only UI change over existing data.
- `npx tsc --noEmit` clean; `npm run lint` reports only pre-existing warnings in
  unrelated files (none in the touched files).
