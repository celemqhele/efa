# WhatsApp Phone-Update + Check-Fixtures

## Feature 1: Phone-number update after result submission

### Problem
Managers text their result from a WhatsApp number, but the phone number stored on their profile (`profiles.phone`) may be missing or different. Nothing updated it.

### Behavior
- After `writeResultToDb` writes a result, `getPhoneUpdatePrompt(from, session, supabase)` compares the messaging number (`from`, normalized to digits) against the stored phones of both match managers.
- If the messaging number matches a manager's stored phone → nothing to do, session cleared, normal "Result submitted!" message.
- If exactly **one** manager's stored phone is missing/different → session set to `awaiting_phone_update`, `phone_update_profile_id` set, and the message becomes:
  `Result submitted!... Check your standings here: ...` + `\n\nYour number on the app does not match the number you are texting from. Update? Yes or No.`
- If **both** managers are candidates (neither stored number matches) → session set to `awaiting_phone_team_confirm`, `phone_update_candidates` set; bot asks which team they manage, then updates.
- On "yes": updates `profiles.phone = from` for the target profile. On "no"/"cancel": keeps it.

### Implementation notes
- `normalizePhone()` strips all non-digits before comparing (`from` is digits-only, `profiles.phone` is inconsistent like `+27 65 261 8652`).
- The session must NOT be cleared when the prompt is shown (the follow-up answer is handled next turn).
- New columns on `whatsapp_sessions`: `phone_update_profile_id uuid`, `phone_update_candidates jsonb` (migration `056_whatsapp_session_phone_update.sql`).
- States: `awaiting_phone_update`, `awaiting_phone_team_confirm`.

## Feature 2: Check fixtures flow

> **Note:** The `check fixtures` command now auto-detects the manager from their number and lists fixtures for all teams they manage — see `check-fixtures-autodetect.md` for the current behavior. The description below covers the (now fallback-only) manual team-name path.

### Behavior
- New command: `fixtures` / `my fixtures` / `check fixtures` (intercepted in `handleText` BEFORE the "I only help with submitting match results" rejection).
- Bot asks team name → `resolveTeamName()` (LLM + DB fallback) → fetches the team with its manager profile (`manager:profiles!teams_manager_id_fkey(id, phone)`).
- **Number check on entry**: if the messaging number (`from`) does NOT match the team manager's stored `profiles.phone` (or the manager has no number), bot asks:
  `The number you are texting from does not match the number on the system for <Team>. Update? Yes or Later.`
  - `Yes` → updates `profiles.phone = from` for that manager → shows fixtures.
  - `Later`/`No` → skips the update → shows fixtures.
  - If the number matches (or there is no manager profile), fixtures are shown directly.
- Fixtures are for **today** by default (key `new Date().toISOString().slice(0, 10)`).
- Output has two sections using the existing `formatFixtureLine` (which already appends `(SUBMITTED)` on confirmed):
  ```
  Fixtures for <Team> on <date>:

  Scheduled:
  1. Home vs Away - Tue 12 Aug · 02:00 - <Tournament>

  Confirmed:
  2. Home 3 - 1 Away - Tue 12 Aug · 02:00 - <Tournament> (SUBMITTED)

  Reply with a number to get your opponent's contact, or type a date (e.g. 15 Aug) to check fixtures for another day. Type CANCEL to exit.
  ```
- Number selection → opponent manager's contact card via `sendContactMessage()` (Graph API v22 `type: 'contacts'`). Number = opponent's `profiles.phone`, fallback `profiles.whatsapp_number`, fallback plain-text message.
- Typed date (via `parseUserDate`, SA conventions) → re-queries that date.
- Note: `formatFixtureLine(f, index)` is 0-based internally (`index + 1`).

### Implementation notes
- Session reuse: `state='awaiting_fixtures_team'` → `state='awaiting_fixtures_phone_confirm'` (if number mismatches) → `state='awaiting_fixtures_action'`; uses `team_id` (existing unused column), `home_team`, `pending_date`, `displayed_fixtures` (fixture ids), `phone_update_profile_id`.
- Query matches fixture when `home_team_id = team OR away_team_id = team` AND `scheduled_date = date`, status in (`scheduled`, `confirmed`), ordered by `matchday, scheduled_date`.
- No `CAT_SYSTEM_PROMPT` change needed (command handled in code before LLM).

## Status
- Migration `056_whatsapp_session_phone_update.sql` applied to Supabase.
- Verified: `npm run lint`, `npx tsc --noEmit`, `npm run build` all pass.
- The "type a different date" path in `awaiting_fixtures_action` is intentionally kept (`parseUserDate` → re-query).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
