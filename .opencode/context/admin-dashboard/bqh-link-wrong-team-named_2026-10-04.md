# BQH deep link: prompt named the sender's own team instead of the opponent

Fixed the wording bug the user hit on their first live test of the BQH reminder link: the bot replied "Noted: **Cape Town City** is not responding" when the sender (`celemqhele`) *manages* Cape Town City. The pinned side was always correct — only the team name printed in the prompt was flipped. Follow-up to `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`.

## Problem

In `openBackdoorFromCode` (`app/api/webhook/route.ts`) the side derivation is correct:

```ts
// side = the side that did NOT respond
const side = ownsHome && !ownsAway ? 'away' : ownsAway && !ownsHome ? 'home' : null
```

Sender owns home → `side = 'away'` → Ben 10 is the non-responding team. The session row confirmed it: `backdoor_side = 'away'` for fixture `09e7f7e1` (Cape Town City vs Ben 10).

But the prompt line mapped that side to the wrong name:

```ts
const opponent = side === 'home' ? aName : hName   // inverted
```

`side` is the **non-responding** side, so `side === 'home'` must print the **home** name, not the away name. As written, the bot told the manager their own club was the one not answering — which reads as the bot accusing the wrong team and would have made a real manager abandon the flow.

## Fix

`app/api/webhook/route.ts`, `openBackdoorFromCode`:

- `const notResponding = side === 'home' ? hName : aName` (was inverted), with a comment
  stating that `side` carries the same meaning as `backdoor_submissions.side_claimed`
  — the same convention `resolveBackdoorSide` / `handleBackdoorSide` already use, where
  `side === 'home'` means the home team gets the 3-0.
- Added an inline comment on the derivation ternary recording that `side` is always the
  opposite of the sender's team, so the two mappings cannot drift apart again.

No template, schema or data change: `side` itself was right, so
`submitBackdoorSubmission` was already filing `side_claimed` against the right team.

## Verification

- Reproduced with the user's own test data: profile `celemqhele` (`+27732509506`) is both an
  admin number and the manager of Cape Town City (home) in fixture `09e7f7e1`
  (Cape Town City vs Ben 10, match code `3UEG5P9V`).
- Session row read back `backdoor_side = 'away'` → data path correct, prompt path wrong.
- Deleted that leftover test session (`state = 'awaiting_backdoor'`, fixture `09e7f7e1`) so a
  stale pin could not be screenshotted into a real backdoor; `whatsapp_sessions` now has 0
  rows for that number. The only `backdoor_submissions` rows for it are two expired August
  ones — today's test never reached submission.
- `npx tsc --noEmit` clean, `next lint` unchanged (pre-existing warnings only),
  `next build` compiles.
- Re-test needed on deploy: opening `BQH MC-3UEG5P9V` from `+27732509506` must now say
  "Noted: Ben 10 is not responding."

## Gotchas / Notes

- `side` in this bot always means **the team getting the 3-0 / the non-responding team**,
  never "the sender's side". Grep for `side === 'home'` before adding new branches.
- The admin double role (admin number *and* team manager) is why this surfaced at all: the
  admin has `isAdminPhone` bypass for ownership but still resolves a real profile/team, so
  the derivation ran. Non-participant admins fall back to the match-centre menu.

## Cross-references

- Feature this fixes: `.opencode/context/admin-dashboard/whatsapp-reminder-compact-template-and-bqh_2026-10-04.md`
  (BQH deep link, `openBackdoorFromCode`, `backdoor_side` pin)
- Template shortening: `.opencode/context/admin-dashboard/whatsapp-reminder-emoji-led-terse_2026-10-04.md`
- Backdoor semantics / admin review: `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`,
  `.opencode/context/backdoor/backdoor-decline-one-claim_2026-10-02.md`
- Session pin: `.opencode/context/whatsapp-results/pin-match-code-sessions-and-reject-cropped-screenshots_2026-10-03.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |