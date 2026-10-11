# Portal forfeit radio: centre the selected dot

Fixed the selected dot in the `Mark as forfeit?` No/Yes radio of the submit-match
portal so it sits dead-centre in its ring. The user reported it "feels slightly up
right". Follow-up to
`.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md` (which
introduced the radio replacing the dropdown).

## Problem

The ring was a flex container (`flex h-4 w-4 items-center justify-center rounded-full
border-2`) with an 8px dot child (`h-2 w-2`). On the user's render the dot read as
offset toward the top-right instead of concentric.

## Fix

In the `ResultForm` component of `app/submit-match/[code]/_portal.tsx` the ring is now
`relative` (no longer a flex container) and the dot is absolutely centred:

```jsx
<span className="relative h-4 w-4 rounded-full border-2 …">
  {forfeit === opt.value && (
    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary" />
  )}
</span>
```

Absolute `left-1/2 top-1/2` + `-translate-x-1/2 -translate-y-1/2` pins the dot to the
ring's centre regardless of flex/line-height quirks. Colours, sizes, labels and the
submitted `forfeit` value are unchanged.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint --file "app/submit-match/[code]/_portal.tsx"` clean.

## Context chain (by path)

- Radio control introduced: `.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md`

## Restore File Section
No repo files were deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
