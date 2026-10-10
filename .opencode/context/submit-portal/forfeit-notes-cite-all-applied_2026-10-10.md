# Forfeit carry-over notes now cite every applied balance, not just the last (10 Oct 2026)

The portal result submission now stores one `forfeit_note:` line per carry-over
balance it applies, so a match that consumed two (or more) balances shows every
source match with its own "Open the match" link instead of only the last one;
`lib/forfeit-note.ts` gained `parseForfeitNotes()` and the four public
fixture/result (desktop + mobile) views render the full list. The user reported
this after the carry-over feature shipped in
`.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`:
looking at a match that had actually consumed two balances, the page only named
one, which "people will question".

## Problem

`app/api/submit-match/route.ts` looped over active `forfeit_balances` and
**overwrote** `overrideReason` on each iteration
(`overrideReason = \`forfeit_note:${bal.fixture_id}:${noteSentence}\``), so only
the last-applied balance survived into `results.override_reason`. The single
`forfeit_note:<fixtureId>:<text>` string it wrote cannot carry more than one
source match, so the public fixture/result pages could only ever show one "Open
the match" citation even when several balances were consumed.

Real case: fixture `8aab9af9-5684-4373-9973-94a676140def` (Casric Stars 12-0
Hope, 2026-10-10). Two `portal_result_submitted` audit rows exist
(16:22:06 "match marked as forfeit", 16:22:57 `is_replacement: true`). The
resubmission typed 3-0 and applied **two** balances to Casric: `3b2b9437`
(this match's own balance, `+6`) and `0366a757` (fixture `8743af05`, `+3`) →
9-0 → 12-0. Only the second (`8743af05`) was cited, so the note misleadingly
read "this 3-0 win became 12-0" while hiding the extra 6.

## Fix / Implementation

1. **Store all notes** — `app/api/submit-match/route.ts`: the balance loop now
   pushes each `forfeit_note:${bal.fixture_id}:${noteSentence}` into a
   `forfeitNotes: string[]` and sets `overrideReason = forfeitNotes.join('\n')`
   when any were applied. Multiple entries are newline-separated; each line is
   self-contained (`forfeit_note:<uuid>:<sentence>`).
2. **Parser** — `lib/forfeit-note.ts`: added
   `parseForfeitNotes(raw): { fixtureId: string; text: string }[]` that splits on
   `\n`, keeps only lines starting with `forfeit_note:`, and splits the first
   `:` after the prefix into `fixtureId` + `text`. Backwards compatible with the
   old single-line rows.
3. **Display** — `app/(public)/fixtures/[id]/_desktop.tsx` & `_mobile.tsx`,
   `app/(public)/results/[id]/_desktop.tsx` & `_mobile.tsx`: replaced the
   single-notice IIFE with a `parseForfeitNotes(...)` list, rendering one line
   per source balance, each with its own `Open the match` link to
   `/fixtures/[fixtureId]`.
4. **Backfill** — updated the one offending row directly via `npm run db`:
   `results.override_reason` for `8aab9af9-…` now carries both lines in
   application order (`…became 9-0…` self-balance, then `…became 12-0…`), so the
   reported page immediately shows both citations.

## Notes / Gotchas

- The webhook carry-over path (`app/api/webhook/route.ts` ~line 6028+) does
  **not** write `override_reason` for balances; it only builds a WhatsApp
  message (`forfeitNoteParts`), so this display change is portal-only.
- The stored multi-line string still contains the substring `forfeit_note:` and
  never `absent`/`both`, so the standings triggers that key off those words are
  unaffected (see `lib/standings-engine.ts:364`).
- The underlying **self-application** is still present: a forfeit creates a
  balance whose `fixture_id` is the same fixture, and a later resubmission of
  that match re-consumes it (the `+6` above). This change only makes the
  inflation visible; it does not de-duplicate. Flagged to the user separately.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint` reports only pre-existing warnings (none in touched files).

## Context Chain (by path)

- Original forfeit/carry-over portal work:
  `.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
- Forfeit "adjusted from" display + `lib/forfeit-note.ts` origin:
  `.opencode/context/forfeit-balances/forfeit-adjusted-display_2026-08-30.md`
- Balance consumption background:
  `.opencode/context/forfeit-balances/forfeit-balance-use-fix_2026-08-16.md`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
