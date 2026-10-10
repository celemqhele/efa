# Review of the flash-lite portal changes: 7-day grace period restored + route.ts mojibake repair

The user had Gemini ("flash lite") apply the portal forfeit/deadline work and asked
for it to be verified; two regressions were found and fixed. First, `deadlineBlock`
had been redefined to fire one day after the match day, so the red "7 day grace
period has ended" banner appeared while the submit option was still clickable
(the user reported exactly this mismatch), and the fixture page's "Change score"
CTA was never greyed out. Second, `app/api/submit-match/route.ts` had been
mangle-encoded: every non-ASCII character (em dash `—`, box-drawing `─`) became a
literal `???`, including user-facing notification strings. Follows up
`.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
(the commit being reviewed) and
`.opencode/context/submit-portal/portal-grace-period-ended-note_2026-10-08.md`
(the original 7-day-grace banner contract this restores).

## Problem

1. **Grace-period mismatch.** `lib/submit-match.ts` gained a `deadlineBlock`
   that returned a message when `dateKey < getSastDateKey(now)` — i.e. one day
   after the match day. `buildState` then set `graceEnded: deadlineBlock(dateKey) !== null`,
   so the banner read "This match's 7 day grace period has ended" from the day
   after the match, while `windowBlock` (the real submission window) still allowed
   submissions through the 7 days. Result: banner up, "Submit the result" still
   clickable. The same premature comparison also drove the postpone/result-change
   blocks.
2. **Change score never greyed.** `app/(public)/fixtures/[id]/page.tsx` exposed
   `canSubmitMatch = isAdmin || isManager` with no grace-period check, so the
   "Change score" / "Submit for this match" CTAs stayed active indefinitely.
3. **route.ts mojibake.** The committed `route.ts` contained 21 lines with `???`
   where `—` and `─` should be (each 3-byte UTF-8 char had been re-saved as three
   ASCII `?`). Some were comments, but several were user-facing message bodies
   (e.g. `'Report the other team ??? the side that is not responding.'`,
   postponement/dispute notification bodies, share text).

## Fix

### `lib/submit-match.ts`
- New `gracePeriodEnded(dateKey, now)` — true only when
  `dateKey < getSastDateKey(now, -MAX_POSTPONE_DAYS)` (strictly more than 7 days
  past the match day). This is the exact boundary `windowBlock`/`postponeWindow`
  already use.
- `deadlineBlock` now returns its message when `gracePeriodEnded(dateKey, now)`
  is true instead of `dateKey < getSastDateKey(now)`. All its call sites
  (`buildState` result/postpone blocks, `submitResult`, `requestPostpone`) now
  align with the real 7-day window.
- `buildState` `rules.graceEnded` now uses `gracePeriodEnded(dateKey)`, so the red
  banner only appears once the grace period has genuinely lapsed — at which point
  `windowBlock` also disables the submit menu. Banner and blocks are consistent.

### `app/(public)/fixtures/[id]/page.tsx`
- Imports `gracePeriodEnded` and derives
  `graceEnded = gracePeriodEnded(fixtureDateKey)` and
  `submitDisabled = canSubmitMatch && !isAdmin && graceEnded`, added to the
  `data` payload (admins keep an active CTA; managers lose it after the window).

### `app/(public)/fixtures/[id]/_desktop.tsx` and `_mobile.tsx`
- The "Change score" and "Submit for this match" CTAs now render a greyed,
  `cursor-not-allowed` `span` (`aria-disabled`, muted border/bg, `opacity-60`,
  title "This match's 7 day grace period has ended") when `data.submitDisabled`,
  otherwise the existing accent `Link`.

### `app/api/submit-match/route.ts`
- Replaced every run of 3+ `?` with an em dash `—` (the separator comments now
  read `// — 1. Submit result —`, and message bodies render the dash), restoring
  the intended text. File now has 0 `???` runs and no U+FFFD.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint` on all five touched files clean.
- `route.ts` scanned: 0 remaining `\?{3,}`; `Read` confirms `—` renders in the
  string literals.
- No behaviour change for admins (still unrestricted); managers keep the full 7
  days and then get a greyed CTA + red banner, matching the original
  `.opencode/context/submit-portal/portal-grace-period-ended-note_2026-10-08.md`
  contract.

## Deliberately not changed

- `submitResult`'s extra `deadlineBlock` guard is now redundant (the earlier
  `windowBlock` check already blocks past 7 days) but is harmless and left in
  place.

## Context chain (by path)

- Commit under review:
  `.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
- Original grace-period banner contract:
  `.opencode/context/submit-portal/portal-grace-period-ended-note_2026-10-08.md`
- Related postpone-window work:
  `.opencode/context/submit-portal/portal-postpone-window-and-status_2026-10-08.md`

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
