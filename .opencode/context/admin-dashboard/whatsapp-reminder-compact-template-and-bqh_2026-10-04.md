# Compact WhatsApp reminder template + BQH backdoor deep link

Replaced the four long, wordy reminder templates with a single six-line, one-item-per-line message (username, match, opponent's number, submit link, report link, bold "just hit send" line) and added a **BQH** token alongside the match code so the "Report them not responding" link drops the manager straight into the backdoor flow with the opponent already pinned as the non-responding side. After the compact match-centre links landed in `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`, the user reported managers were not reading the reminder at all — it was still a wall of prose with one link buried at the end of a sentence.

## Problem

1. **Reminder too long to read.** `buildReminder` in `components/ui/DashboardFixtureActions.tsx` produced a single-paragraph sentence per time slot (morning/afternoon/evening/night) with the bot link appended mid-sentence. Managers skimmed past it, so results and backdoor reports were still not coming in.
2. **No opponent number.** The reminder never told the manager who to chase, which is the whole point of a "match due" nudge.
3. **Backdoor needed an extra step.** The match centre's option 2 pinned the fixture but still asked "Who is not responding?" (`app/api/webhook/route.ts`), so the manager had to type a team name before the screenshot could be filed. The reminder link already proves which fixture and which manager, so that question is redundant.

## Fix

### `lib/phone.ts`
- New `formatPhoneDisplay(phone)`: `+{cc} {local[0..2]} {local[2..]}` — always `+XX XX XXXXXXX`, e.g. `27788707749` → `+27 78 8707749`. Returns `''` when there is no number so callers choose between omitting the line and a placeholder.

### `components/ui/DashboardFixtureActions.tsx`
- `getTimeSlot()` / `TimeSlot` / `TIME_SLOT_LABELS` and the `Morning/Afternoon/Evening/Night` label span are **gone** — one template for all times.
- `buildReminder(params)` now takes an object and returns one line per item:
  ```
  Hi {username}
  Matches due: {home} vs {away}
  Their number: {opponentPhone or "not available"}
  Submit result: {submitLink}
  Report them not responding: {reportLink}
  *WHEN CLICKING LINK JUST HIT SEND, DON'T EDIT TEXT*
  ```
  Bold is WhatsApp's single-asterisk form. The number line is plain text (not a `wa.me`
  link) per the user's "+XX XX XXXXXXX only" rule.
- Two links from the same fetched fixture code:
  - `reminderLink` → `Hi MC-<CODE>` (unchanged, opens the match centre)
  - `backdoorLink` → `Hi BQH MC-<CODE>` (new, opens the backdoor flow)
  - both still fall back to plain `Hi` while the code loads / if a fixture has none.
- The home manager's message shows `awayManagerPhone` as "their number" and vice versa
  (both props already reach the component from `app/(admin)/admin/dashboard/_desktop.tsx`
  and `_mobile.tsx`).

### `app/api/webhook/route.ts`
1. `BQH_TOKEN_RE = /\bBQH\b/i` next to `MATCH_CODE_RE`. `handleMatchCentreLink` branches
   on it **after** the shared code → fixture lookup, ownership check and 7-day date gate,
   so both links get identical validation.
2. New `openBackdoorFromCode(from, fixture, manager, phoneNumberId)`:
   - derives the non-responding side from the sender: `getLoggedInManager` → if they own
     exactly one of the fixture's teams, the **other** team is the non-responding side;
   - side not derivable (admin with no team here, or a manager owning both sides) →
     falls back to opening the match-centre menu so they can still pick option 2;
   - `isBackdoorWindowEnabled` gate → `BACKDOOR_DISABLED_MESSAGE`;
   - `clearSession` + `upsertSession({ state:'awaiting_backdoor', backdoor_menu_step:'screenshot',
     matched_fixture_id, backdoor_side: side, pinned_until: pinExpiryIso() })` then asks
     only for the screenshot.
3. The backdoor **screenshot** branch in `POST` now checks `activeSession.backdoor_side`
   first: when set it stores the media id and calls
   `submitBackdoorSubmission(from, session, side, phoneNumberId)` immediately, skipping
   the "Who is not responding?" prompt entirely.
4. Extracted the tail of `handleBackdoorSideSelect` (window re-check, duplicate-report
   check, fixture-status check, storage upload, `backdoor_submissions` insert, admin
   notify, `clearSession`) into `submitBackdoorSubmission(from, session, side, phoneNumberId)`.
   The typed-side path and the BQH path therefore run **identical** gates.
5. Stale-pin hygiene: every generic "start a backdoor from the menu/command" upsert now
   writes `backdoor_side: null, matched_fixture_id: null`, so a fixture/side pinned by a
   BQH link can never leak into a later flow that starts with a partial upsert.

**No migration needed** — `whatsapp_sessions.backdoor_side` already existed (migration
`046_whatsapp_session_backdoor_columns.sql`) and was unused, and `pinned_until` came with
`.opencode/context/whatsapp-results/pin-match-code-sessions-and-reject-cropped-screenshots_2026-10-03.md`'s
migration `094`.

## Verification

- `npx tsc --noEmit` clean; `npx next lint` shows only pre-existing warnings (none in the
  three touched files); `npx next build` succeeds.
- `formatPhoneDisplay` spot-checked via tsx: `27788707749` → `+27 78 8707749`,
  `0674008857` → `+27 67 4008857`, `233241234567` → `+233 24 1234567`, `null` → `''`.
- Live WhatsApp walkthrough of both reminder links still pending on deploy (submit link
  behaviour unchanged; BQH path is new).

## Gotchas / Notes

- The BQH side derivation relies on the sender's number being on a profile with a team.
  Managers whose profile phone is missing fall back to the match-centre menu (option 2),
  which still works — they just answer the side question.
- `upsertSession` deliberately omits `pinned_until` unless passed, so the BQH pin written
  at link-open time survives the screenshot upsert.
- Reminder text now contains two long `wa.me` URLs; WhatsApp wraps them. That was accepted
  over shortening the links, since the whole point is that the manager just hits send.

## Cross-references

- Reminder-link chain: `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md`,
  `.opencode/context/admin-dashboard/time-based-whatsapp-reminders-5am-night-fix_2026-09-09.md`,
  `.opencode/context/admin-dashboard/whatsapp-reminder-link-session-expiry_2026-09-22.md`,
  `.opencode/context/admin-dashboard/whatsapp-reminder-player-target-fix_2026-09-22.md`
- Match codes: `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`,
  `.opencode/context/match-codes/match-code-generation-and-backfill_2026-09-30.md`,
  `.opencode/context/match-codes/admin-match-code-any-fixture_2026-09-30.md`
- Backdoor flow: `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`,
  `.opencode/context/backdoor/backdoor-dashboard-link_2026-08-15.md`,
  `.opencode/context/whatsapp-results/pin-match-code-sessions-and-reject-cropped-screenshots_2026-10-03.md`
- Phone formatting helpers live in `lib/phone.ts` (see also
  `.opencode/context/international-phone/country-code-dropdown_2026-09-01.md`).

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |