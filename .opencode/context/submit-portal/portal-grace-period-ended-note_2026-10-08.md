# Portal: red note when the 7-day grace period has ended

Follow-up on `.opencode/context/submit-portal/portal-postpone-window-and-status_2026-10-08.md` (the 7-day-after-deadline postpone window). The user asked whether, once the 7 days are up, the portal shows a red note that the match "can no longer be changed or postponed" — it did not (the Postpone/Submit cards simply went grey/disabled with a muted block message), so a red banner was added.

## Problem

After `MAX_POSTPONE_DAYS` (7) past the match deadline, `buildState` set `postponeBlock` / `resultBlock` and the portal dishes these out as disabled menu cards (`opacity-60`, sub text in `text-text-muted`) with no prominent warning. Nothing told the viewer the grace period itself had lapsed.

## Fix

- `lib/submit-match.ts` — `buildState` now returns `rules.graceEnded: postponeWindow(dateKey) !== null` (true only when the match is >7 days past its deadline; the future/open side of the window stays null).
- `app/submit-match/[code]/_portal.tsx` — the header `Card` shows a red banner when `state.rules.graceEnded`:
  - `This match's 7 day grace period has ended`
  - `It can no longer be changed or postponed.`
  - Styled like the existing postponed banner but in feedback-error red: `border border-feedback-error/40 bg-feedback-error/10 text-feedback-error`.

## Verification

- `npx tsc --noEmit` clean.
- `text-feedback-error` is an existing token (used e.g. in `app/(protected)/profile/_mobile.tsx`); the `border-feedback-error/40 bg-feedback-error/10` alpha combination matches the in-file postponed banner pattern (`border-feedback-warning/40 bg-feedback-warning/10`).

## Files touched

- `lib/submit-match.ts` — `graceEnded` on `rules`.
- `app/submit-match/[code]/_portal.tsx` — red banner in the header card.