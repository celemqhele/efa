# WhatsApp Check-Fixtures Auto-Detect

## Problem
`check fixtures` always asked "What is your team name?" even when the number texting in was already a manager on the system. For managers whose number is on their profile this is an unnecessary step every time.

## Fix
The `check fixtures` command now identifies the manager from their WhatsApp number first and skips the team-name question when possible:

- **Number recognized** (`phoneNumbersMatch(profile.phone, from)`) → fetch **all** teams where `teams.manager_id = profile.id` and list fixtures for every one of them in one message:
  `Fixtures for Atlas Lions & Nantes on Sat 15 Aug:` with Scheduled:/Confirmed: sections, continuously numbered.
- **Number not recognized, or manager owns no teams** → falls back to the old flow: ask team name, then offer the number-update prompt (`awaiting_fixtures_phone_confirm`) if that team's stored number doesn't match `from`.

Multi-team managers are expected, so the flow always works off a **list of team ids** (`fixtures_team_ids`).

## Key changes (`app/api/webhook/route.ts`)
- `phoneNumbersMatch(stored, from)`: digit-normalized compare that also handles the SA local (`0694021679`) vs international (`27694021679`) difference by swapping a leading `0` for `27`. Used by the auto-detect, `getPhoneUpdatePrompt`, and `handleFixturesTeam` (so local-format stored numbers no longer trigger a false "update?" prompt).
- `handleCheckFixturesCommand(from, phoneNumberId)`: called by the `check fixtures` intercept. Looks up `profiles.phone` vs `from`, then the profile's teams.
- `sendFixturesForTeam` → `sendFixturesForTeams(from, teamIds[], teamNames[], dateKey, phoneNumberId)`: `.or()` filter built per team; header shows `teamNames.join(' & ')`.
- **Ordering fix**: `displayed_fixtures` is now `[...scheduled ids, ...confirmed ids]` to match the on-screen numbering (previously it used raw query order, which could mismatch the shown index when confirmed/scheduled interleave).
- `sendOpponentContact(fixtureId, myTeamIds[])`: opponent = the fixture team not owned by the caller (both-owned or neither-owned → home team fallback).
- Session reuse: `state='awaiting_fixtures_action'` with `fixtures_team_ids` (array), `home_team` (display label), `pending_date`, `displayed_fixtures`.
- Migration `057_whatsapp_session_fixtures_team_ids.sql` adds `fixtures_team_ids jsonb` to `whatsapp_sessions`.

## Verified
- `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- Phone formats confirmed mixed in DB (international `+27732509506`, `+233591519713`; local `0694021679`) → prefix-aware matching required.
- 2 profiles currently manage 2 teams each — combined listing covers them.

## Related files
- Supersedes the manual team-name path documented in `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`.
- `sendOpponentContact` is later touched by `.opencode/context/check-fixtures/contact-card-phone-fix_2026-08-15.md` (E.164 formatting) and `.opencode/context/check-fixtures/fixtures-contact-closes-session_2026-08-15.md` (session close on contact send).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
