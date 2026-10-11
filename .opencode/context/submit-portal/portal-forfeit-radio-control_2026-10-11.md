# Portal "Mark as forfeit?" is a No/Yes radio, not a dropdown

Replaced the `Mark as forfeit?` `<select>` dropdown in the submit-match portal with
a two-option radio group (No / Yes) rendered as clickable circles that fill with a
solid dot when selected. The user reported the dropdown felt wrong and asked for the
familiar yes/no radio (a filled dot marks the chosen circle). Follows the portal
work in `.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
and `.opencode/context/submit-portal/portal-screenshot-required-message_2026-10-07.md`.

## Problem

`app/submit-match/[code]/_portal.tsx` rendered the forfeit question as a `<select>`
with `No — played normally` / `Yes — forfeited (+3 goals to winner)`. The user wanted
a compact yes/no radio control instead.

## Fix

In the `ResultForm` component of `app/submit-match/[code]/_portal.tsx`:

- Removed the `<Field>` + `<select>` block and the `inputClass` usage for it.
- Added a manual block (kept OUT of the `<label>`-wrapping `Field` component to avoid
  nested labels): a heading span, a `flex items-center gap-6` row of two options, and
  the explainer as a hint line below.
- Each option is a `<label>` containing an `sr-only` `<input type="radio"
  name="result-forfeit" value="no|yes">` plus a visible ring
  (`h-4 w-4 rounded-full border-2`, `border-text-primary` when selected else
  `border-border`) with an inner dot (`h-2 w-2 rounded-full bg-text-primary`) shown
  only when selected. Labels read `No` / `Yes`; default remains `No`.
- Disabled state (`!!block || busy`) dims the label (`opacity-60`, `cursor-not-allowed`)
  and disables the inputs.
- The dot uses the theme primary colour (`text-text-primary`) rather than hardcoded
  black so it stays visible in light and dark mode (user was told this; black can be
  hardcoded later if asked).
- The submitted `forfeit` form value (`'no' | 'yes'`) is unchanged, so the server
  path in `app/api/submit-match/route.ts` is untouched.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint --file "app/submit-match/[code]/_portal.tsx"` clean.

## Context chain (by path)

- Portal forfeit rules: `.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
- Screenshot required message: `.opencode/context/submit-portal/portal-screenshot-required-message_2026-10-07.md`
- Carry-over score rule (this session): `.opencode/context/forfeit-balances/forfeit-carryover-discards-forfeiter-score_2026-10-11.md`

## Restore File Section
No repo files were deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
