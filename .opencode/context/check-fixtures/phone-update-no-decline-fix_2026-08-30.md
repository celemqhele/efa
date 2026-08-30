# Phone-update "no" treated as "yes" — two-candidate decline fix (30 Aug)

Fixed the two-candidate phone-number update flow so that replying **"no"** to
"Your number on the app does not match the number you are texting from. Update?
Yes or No." now correctly declines (instead of being misread as a team name /
treated as a yes). The single-candidate flow in `handlePhoneUpdate` already handled
yes/no; the two-candidate flow (`awaiting_phone_team_confirm`) did not. This is a
follow-up to the numbered cancel/restart hint work in
`.opencode/context/whatsapp-ux/numbered-cancel-restart-hint_2026-08-30.md` and the
original phone-update flow in
`.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`.

## Problem

When a manager submitted a result, `getPhoneUpdatePrompt`
(`app/api/webhook/route.ts`) shows the same "Update? Yes or No." message for both
phone flows:

- **Single candidate** → state `awaiting_phone_update`, handled by
  `handlePhoneUpdate` (which understands `isYes` / `isNo`).
- **Two candidates** (both managers' stored numbers differ from the texting
  number) → state `awaiting_phone_team_confirm`, handled by
  `handlePhoneTeamConfirm` — but that handler only understood cancel or a team
  name, **not** yes/no.

Bugs that resulted:
1. A user answering "no" to the yes/no prompt was treated as a team-name reply,
   failed to match, and the bot re-asked "Which team do you manage?" — it looked
   like the "no" had been interpreted as a "yes" and the flow got stuck.
2. A user answering "yes" had to immediately name a team anyway (the prompt
   intent was ambiguous).

## Fix (`app/api/webhook/route.ts`)

In `handlePhoneTeamConfirm`:

- Treat `isNo(text)` (or cancel) as a decline → clear session, reply "No problem.
  Your number stays as it is."
- Treat `isYes(text)` as confirmation → re-ask "Which team do you manage?" (the
  candidates are stored on the session), so the next reply picks the profile to
  update.
- Team-name replies keep working exactly as before.

## Verification

`npx tsc --noEmit` clean; `npm run lint` reports only pre-existing warnings in
unrelated files (none in the touched code).

## Context chain (by path)

- Numbered cancel/restart hint (which added FLOW_HINT to these prompts):
  `.opencode/context/whatsapp-ux/numbered-cancel-restart-hint_2026-08-30.md`
- Original phone-update + check-fixtures flow:
  `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | Edit to existing file | N/A |
