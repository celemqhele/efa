# Portal: Yes/No questions get the accent colour so they are skimmable (2026-10-21)

The four Yes/No questions in the submit-match portal were rendered in
`text-text-muted`, a 12px bold label that blended into the card background. The
manager asked for them to be a different colour because his users "don't like to
read properly" and the goal is for the questions to be skimmable at a glance.
Follows the button/radio work in
`.opencode/context/submit-portal/portal-failed-to-fetch-and-replay-toggle_2026-10-20.md`
and the control itself from
`.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md`.

## Problem

Every Yes/No question heading used the same class:

```
text-xs font-bold uppercase tracking-wide text-text-muted
```

`--color-text-muted` is `#718096`. Measured against the two surfaces it sits on
(WCAG relative luminance), that is:

| Colour | Surface | Ratio | Verdict |
|---|---|---|---|
| `#718096` (muted, old) | `#171A21` bg-surface | 4.34 | fails AA for its size |
| `#718096` (muted, old) | `#0F1117` bg-base | 4.70 | borderline |
| `#D6B65D` (accent, new) | `#171A21` bg-surface | 8.88 | PASS AA |
| `#D6B65D` (accent, new) | `#0F1117` bg-base | 9.62 | PASS AA |

At 12px bold the old label is not "large text", so 4.34:1 is a genuine AA fail —
which is exactly why it read as background noise rather than a question.

## Fix

`app/submit-match/[code]/_portal.tsx`, all four question headings now use
`text-sm font-black uppercase tracking-wide text-accent` (brand gold `#D6B65D`,
also the colour already used for the card numbers and links):

- "I want to continue getting WhatsApp reminders" (home panel, `ReminderPrefCard`)
- "Did you play many times due to network or disconnections?" (`ResultPanel`)
- "Did this player give you the win?" (`ResultPanel`)
- "Mark as forfeit?" (`ResultPanel`)

Each question's selected radio dot also switched from `border-text-primary` /
`bg-text-primary` to `border-accent` / `bg-accent`, so the chosen answer is
visible in the same highlight colour as the question — a skimmer sees the
question and the picked option together without reading either.

The hint/explainer lines under each question stayed `text-xs text-text-muted` on
purpose: keeping the detail dim is what makes the accent question stand out by
contrast, so the eye lands on the question and the answer, not the paragraph.

## Verified

- Contrast computed with WCAG relative luminance: accent 8.88:1 on `bg-surface`,
  9.62:1 on `bg-base` (both PASS AA); the old muted 4.34:1 / 4.70:1.
- `grep` confirms no `border-text-primary` / `bg-text-primary` radio dots remain
  in the file, and exactly four `font-black uppercase tracking-wide text-accent`
  question headings exist.
- `npx tsc --noEmit` clean; `npx next lint` clean; `npx next build` succeeds.
- `public/sw.js` restored with `git checkout --` after the build rewrote it.

## Context chain (by path)

- Previous portal change on the same file:
  `.opencode/context/submit-portal/portal-failed-to-fetch-and-replay-toggle_2026-10-20.md`
- The Yes/No radio control this recolours:
  `.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md`
- The portal itself:
  `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
