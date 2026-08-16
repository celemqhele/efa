# Backdoor "who is not responding" — ask for the team name, not home/away (16 Aug)

## Problem
The backdoor flow asked the manager to reply `home` or `away` for two things:
- User flow: *"Who is not responding? Reply 'home' or 'away'."*
- Admin override: *"Who gets the 3-0 win? Reply 'home' or 'away'."*

Typing a **team name** (what managers actually type) failed every time — the
handlers only accepted the constant `home`/`away` and re-prompted with
*"Reply 'home' or 'away'."* until the user typed a literal side.

## Fix
`app/api/webhook/route.ts`:
- New helper `resolveBackdoorSide(supabase, fixtureId, text)` → `'home' | 'away' | null`:
  - Still accepts literal `home`/`away` for backwards compatibility.
  - Otherwise matches the typed text against the fixture's home/away team names
    (case-insensitive, exact), then falls back to `resolveTeamName()` (existing
    alias/LLM resolver). Returns `null` when nothing matches → re-prompt.
- Prompts now ask for the team name, listing both teams:
  - User flow single match (`handleBackdoorFixtureSearch`) and numbered list
    (`handleBackdoorFixtureSelect`): *"Who is not responding? Type the team name
    (e.g. X or Y). Type CANCEL to abort."*
  - Admin override (`handleBackdoorFixture`, `handleBackdoorOverrideConfirm`):
    *"Who gets the 3-0 win? Type the team name (e.g. X or Y). Type CANCEL to abort."*
  - Stray-screenshot prompt (`backdoorPrompts['side']`): *"Type the team that is
    not responding."*
- Re-prompt/validation messages in `handleBackdoorSideSelect` and `handleBackdoorSide`
  show the concrete team names so the user knows what to type.
- `handleBackdoorSideSelect` / `handleBackdoorSide` now resolve via the helper and
  then run the exact same logic as before (fixture fetch, `side_claimed` semantics,
  duplicate gates, screenshot upload, override handling, notifications).

No behaviour change to `side_claimed` or scoring — only how the side is resolved.

## Notes / Gotchas
- `resolveBackdoorSide` fetches team names per resolution attempt; the
  `handleBackdoorSide` admin-override path needed an extra fixture fetch because
  it previously only selected `home_team_id/away_team_id`.
- `npx tsc --noEmit` and `npm run lint` pass.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
