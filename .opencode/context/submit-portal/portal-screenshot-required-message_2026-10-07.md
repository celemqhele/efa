# Submit portal: missing-screenshot warning message (2026-10-07)

Follow-up to `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`.
The user confirmed a proof screenshot is mandatory (the server already enforced it) but pointed out
the form gave no message when a screenshot was missing.

## What changed

In `app\submit-match\[code]\_portal.tsx`, the Result and Backdoor panels previously kept the submit
button `disabled` until a file was picked, so a manager who tapped submit without a screenshot got
no feedback at all. Now:

- The button stays enabled (subject to `busy`/`block`; scores still gate the result button).
- Clicking submit without a file renders an inline warning: `Upload the result screenshot above
  first — it is kept as proof.` (Result) and `Upload the proof screenshot above first.` (Backdoor).
- The warning clears as soon as a file is chosen.

Server-side enforcement was already in place (`app\api\submit-match\route.ts` rejects when no file
is present).