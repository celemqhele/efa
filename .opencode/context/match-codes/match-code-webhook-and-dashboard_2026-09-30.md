# Match-centre deep links — webhook resolution + dashboard reminder links

Implemented the WhatsApp side of the match codes: the admin dashboard reminder
links now embed the per-fixture code (`?text=Hi MC-XXXX`), and the webhook
resolves that code into a "match centre" session bound to the fixture — it ends
any current session, verifies the sender is one of the match's two managers, and
offers submit-result / report-not-responding / main-menu. Follows the data layer
built in `.opencode/context/match-codes/match-code-generation-and-backfill_2026-09-30.md`.

## Problem

Reminder links previously preloaded a bare `Hi`, which dropped the manager on
the generic welcome menu and could collide with a stale mid-flow session within
the 60-minute expiry window (see
`.opencode/context/admin-dashboard/whatsapp-reminder-link-session-expiry_2026-09-22.md`).
With codes now generated for every fixture (trigger + Season 4 backfill), the
link can carry the fixture identity so the bot opens the right match directly
and always resets the session first.

## Fix

**`app/api/webhook/route.ts`**
1. New early entry `handleMatchCentreLink(from, text, phoneNumberId)` — runs at
   the very top of `handleText`, before the session is read, so it can reset any
   flow: parses `MC-XXXXXXXX` (`MATCH_CODE_RE`), looks up code → fixture via the
   `match_codes` table, and — when the code is unknown — returns false so normal
   handling continues. When found it:
   - rejects senders who don't manage either team on the fixture
     (`managerOwnsFixture` via `getLoggedInManager` teamIds),
   - gates the 7-day window: out-of-window fixtures get the fixed
     "…unavailable for submission as it is older than 7 days." message (or the
     mirror for >7 days ahead) and NO session is opened,
   - otherwise `clearSession` (SQL delete — ends old sessions) then
     `upsertSession({ state: 'match_centre', matched_fixture_id, home_team, away_team })`
     and sends the welcome + numbered menu.
2. New `match_centre` state branch in `handleText` → `handleMatchCentreMenu`:
   - `1` submits → reuses the existing logged-in screenshot step, pre-bound to
     the fixture (`loggedin_first_time_screenshot`, backdoor-replacement note
     included when the fixture already has a backdoor result).
   - `2` backdoor → `awaiting_backdoor` with `backdoor_menu_step: 'screenshot'`,
     carrying `matched_fixture_id` (respects `backdoor_window.enabled`).
   - `3` → clear + welcome menu; any other input → re-prompt the menu.
3. Backdoor image step in POST: when a backdoor screenshot arrives while
   `matched_fixture_id` is set (i.e. from the match centre), skip the team-name
   fixture search and jump straight to the existing `side` step ("who is not
   responding?"), storing `backdoor_screenshot_media_id`.

**`app/api/admin/fixtures/[id]/match-code/route.ts`** (new) — admin-only GET that
returns `{ code }` for a fixture (`null` when absent), so the dashboard can build
coded links without Server Component churn.

**`components/ui/DashboardFixtureActions.tsx`**
- Reminder link is now built from the fixture's code:
  `https://wa.me/27818209406?text=Hi MC-<CODE>`; falls back to plain `Hi` from
  `FALLBACK_REMINDER_LINK` while loading or if the code is missing.
- Codes are fetched client-side on mount via the new API, with a module-level
  `Map<fixtureId, Promise>` cache so admin fixture pages don't refetch per row.
- `buildReminder(...)` now takes the bot link as a parameter; all four time-slot
  templates keep their wording.

## Verification

- `npx tsc --noEmit` clean; `next lint` only pre-existing warnings; `next build`
  succeeds and emits `/api/admin/fixtures/[id]/match-code`.
- Season 4 fixtures all carry codes (608, unique) — so every reminder link on
  today's/matches' admin rows resolves.
- Code→fixture join sample: Sekhukhune vs Wits → `MC-3D6K689L`.
- Manual WhatsApp test pending on deploy (release not performed in this task).

## Gotchas / Notes

- The same fixture code works from either manager's number; the webhook verifies
  ownership before opening the centre.
- `getLoggedInManager` matches by stored profile phone — managers without a phone
  on file (none left in active tournaments) can't open the centre.
- Future fixtures created after the 084 trigger gets codes automatically, so the
  dashboard never needs a second backfill.

## Cross-references

- Data layer: `.opencode/context/match-codes/match-code-generation-and-backfill_2026-09-30.md`
- Reminder-link chain: `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md`,
  `.opencode/context/admin-dashboard/whatsapp-reminder-link-session-expiry_2026-09-22.md`,
  `.opencode/context/admin-dashboard/whatsapp-reminder-player-target-fix_2026-09-22.md`
- Backdoor flow reuse: `.opencode/context/whatsapp-logged-in/whatsapp-logged-in-first-submit_2026-09-22.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |