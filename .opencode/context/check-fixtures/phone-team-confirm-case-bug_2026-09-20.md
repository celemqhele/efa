# Phone-update "which team" loop — case-sensitive team-name match fix (20 Sep)

Fixed the two-candidate phone-update flow so replying with the team name
now works regardless of capitalization. The user reported that after the bot
asked "Which team do you manage? Reply Barcelona or Arsenal." every reply
made it re-ask the same question over and over. This is a follow-up to
`.opencode/context/check-fixtures/phone-update-no-decline-fix_2026-08-30.md`
(the "no treated as yes / re-ask loop" fix) and the original flow in
`.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`.

## Problem

In `handlePhoneTeamConfirm` (`app/api/webhook/route.ts`), the team-name match
compared the user's reply against lowercased candidate team names, but the
reply itself was never lowercased:

```ts
const lower = cleanTeamInput(text)          // NOT lowered despite the name
c.teamName.toLowerCase() === lower ||       // "barcelona" === "Barcelona" → false
lower.includes(c.teamName.toLowerCase()) || // "Barcelona".includes("barcelona") → false
c.teamName.toLowerCase().includes(lower)    // "barcelona".includes("Barcelona") → false
```

`cleanTeamInput` → `normalizeText` strips quotes/punctuation but does NOT call
`toLowerCase()`. Every other call site pipes the cleaned input through
`toLowerCase()` (e.g. line 666/668/1482, or into `resolveTeamName` which
lowercases internally), but this handler forgot it. So a reply typed exactly as
the prompt displays it ("Barcelona", capital B) failed all three comparisons and
the handler hit the `!match` branch at line 1104, re-asking the same question
forever. Replies typed fully lowercase worked, which made the bug look random.

## Fix (`app/api/webhook/route.ts`)

- `handlePhoneTeamConfirm`: `cleanTeamInput(text)` → `cleanTeamInput(text).toLowerCase()`.
- Same latent defect in `resolveBackdoorSide` (used by the backdoor "who gets
  the 3-0 win" side picker): `input` now lowercased too, so the `home`/`away`
  and exact team-name paths compare case-insensitively instead of relying on
  the `resolveTeamName` fallback to mask it.

## Verification

`npx tsc --noEmit` clean; `npm run lint` reports only pre-existing warnings in
unrelated files (none in the touched code).

## Context chain (by path)

- "no treated as yes / re-ask loop" fix: `.opencode/context/check-fixtures/phone-update-no-decline-fix_2026-08-30.md`
- Original phone-update + check-fixtures flow: `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | Edit to existing file | N/A |