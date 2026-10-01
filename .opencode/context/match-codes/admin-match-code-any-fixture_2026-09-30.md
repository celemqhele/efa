# Admins can open any match code in the match centre

## Intro
Follow-up to `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`: the user reported that sending `Hi MC-XXXX` for a match they don't manage gets rejected with *"This match code is not linked to one of your teams."* They want admins to be able to open any match code. This is a one-line gate change — the admin bypass pattern already existed everywhere else in the bot, it just was never wired into the match-centre entry.

## Problem
`handleMatchCentreLink()` (`app/api/webhook/route.ts`) opens a match-centre session only when `managerOwnsFixture(manager, fixture)` is true, i.e. the sender manages one of the fixture's two teams. That check is the *only* entry gate — a non-admin gets a hard refusal and no session.

This was correct when written, but it sits oddly next to the rest of the bot, where admins consistently bypass the same class of restriction:

- the 7-day submission window (`isInSubmissionWindow` is only enforced when `!isAdminPhone(from)`) — see `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
- the final safety gate in `writeResultToDb()`, which is explicitly commented as *"prevents any bypass through the direct-bypass or LLM-confirm paths"* and is skipped for admins
- the team-pair search and the `submissionBlockReason()` checks throughout

So an admin could submit for any fixture via the text/team-name route but not via the code link — an inconsistency with no security reason behind it, since the code is not a secret (it is printed on every admin dashboard reminder link and stored in `match_codes`).

## Fix
`app/api/webhook/route.ts` — `handleMatchCentreLink()`:

```ts
const isAdmin = isAdminPhone(from)
const manager = await getLoggedInManager(from)
if (!isAdmin && !managerOwnsFixture(manager, fixture)) {
  await sendTextMessage(from, 'This match code is not linked to one of your teams. Send "Hi" for the main menu.', phoneNumberId)
  return true
}
```

Only the ownership gate changed. Deliberately left alone:

- **The 7-day window inside the match centre** (`isInSubmissionWindow(dateKey)` at the top of the same function) is *not* bypassed here. The user asked specifically about the ownership refusal, and the downstream `writeResultToDb()` gate already lets admins through on the write, so widening the entry window too would only duplicate that. If an admin hits the "older than 7 days" message from a code, the fix is a one-word change to the same `isAdmin` variable — say the word and it goes in.
- **Unknown codes still fall through** (`if (!fixture) return false`) so a mistyped `MC-…` from anyone, admin included, still reaches normal handling rather than silently consuming the message.
- The backdoor option (`2`) inside the centre keeps its own `isBackdoorWindowEnabled()` check.

## Verification
- `npx tsc --noEmit` clean.
- `npx eslint app/api/webhook/route.ts` → 7 warnings, all pre-existing unused-var warnings at lines 29, 1094, 2008, 2388, 2563, 3172, 3604. None touch `handleMatchCentreLink` (line 3681).
- Downstream paths confirmed **not** to re-check ownership, so an admin who is not a manager on the fixture can complete the whole flow:
  - `handleMatchCentreMenu` option `1` writes `state: 'loggedin_first_time_screenshot'` with `matched_fixture_id`, `home_team`, `away_team` — no manager identity is stored on the session, and it is keyed entirely off `session.matched_fixture_id`.
  - the confirm step and `writeResultToDb()` gate on `submissionBlockReason()`, which is already skipped for `isAdminPhone(from)`.
- Manual WhatsApp test pending on deploy.

## Cross-references
- `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md` — the code link + match centre itself
- `.opencode/context/match-codes/match-code-generation-and-backfill_2026-09-30.md` — code generation and Season 4 backfill
- `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md` — the established admin-bypass convention this change follows
- `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md` — the other admin-any-date path

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |