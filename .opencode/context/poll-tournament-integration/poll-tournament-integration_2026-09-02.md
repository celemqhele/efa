# Poll–Tournament Application Integration — 2026-09-02

Combined the standalone **admin poll** system with the **tournament application** (season-seat) system so that poll applications become proper tournament applications when a poll is linked to a season. Admin now reviews all pending applications (direct + poll-sourced) in one place; approving a poll-sourced application makes the user manager of the selected team via the existing slot-filling logic.

After the earlier work on user-based slots (`.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`), the two systems remained separate: polls were first-come-first-served with no admin approval path, while tournament applications had full pending→approved/denied/expired flow. This change wires them together by letting admins create a poll *for a specific season*; applications submitted through that poll create `tournament_applications` rows (with `poll_id` set) instead of `poll_applications` rows, and appear in the unified admin review page.

## Problem

- Polls and tournament applications were completely separate flows
- Poll applications had `pending`/`approved`/`denied` statuses in the DB but **no code ever set `approved`** — admin could only delete applications
- Users saw two different UIs for "applying for a team"
- Admin had to check two different pages to review applications
- When a poll application was "accepted" there was no automatic manager assignment — the "Import from Poll" button in SeasonManager was a manual separate step

## Fix

### Database (migration `071_link_polls_to_seasons.sql`)
- Added `season_id` (nullable FK to `seasons`) to `polls` table
- Added `poll_id` (nullable FK to `polls`) to `tournament_applications` table
- Added indexes on both new columns

### Admin poll creation (`app/api/admin/polls/route.ts`, `app/(admin)/admin/polls/page.tsx`)
- New optional **Season** dropdown when creating a poll
- If `season_id` provided, poll becomes "season-linked"
- GET `/api/admin/polls` now joins `season` so the admin list shows which season each poll belongs to

### Poll apply flow (`app/api/polls/[share_code]/apply/route.ts`)
- When poll has `season_id`:
  1. Validates season is open and has vacant seats (`listOpenSeasons`)
  2. Validates team is pickable for that season (`getSeasonPickableTeams`)
  3. Validates user not already in season (`userInSeason`)
  4. Validates no duplicate pending tournament application for user+season
  5. Creates `tournament_application` with `status=pending`, `expires_at=+7d`, `poll_id` set
- When poll has NO `season_id`: legacy FCFS behavior unchanged (writes to `poll_applications`)

### Unified admin review (`app/api/admin/tournament-applications/list/route.ts`, `app/(admin)/admin/tournament-applications/page.tsx`, `app/(admin)/admin/tournament-applications/_review.tsx`)
- List query now joins `poll:poll_id(id, title)`
- Review page shows **poll badge** ("via Poll Title") for poll-sourced applications
- Same Approve/Deny buttons — existing `approveSeasonApplication` → `fillVacantSlot` logic handles both types identically
- Since user always ends tenures before polls, all poll teams are vacant seats; no sack-cooldown issues

### Public poll page (`app/(public)/polls/[share_code]/page.tsx`, `PollClient.tsx`, `_desktop.tsx`, `_mobile.tsx`)
- Detects `poll.season_id` and passes `isSeasonLinked` to client components
- For season-linked polls:
  - Fetches pickable teams via `getSeasonPickableTeams` (only unmanaged clubs with seats in that season's tournaments)
  - Fetches user's applications and taken slots from new `/api/tournament-applications/me?season_id=...` endpoint
  - Status badge shows **"Awaiting Review"** instead of "Pending"
  - **No withdraw button** — tournament applications expire automatically after 7 days
  - Success message: "Application submitted for X! Awaiting admin review."
- Legacy polls: unchanged FCFS UI with withdraw

### New endpoint
- `app/api/tournament-applications/me/route.ts` — returns taken slots + my applications for a given `season_id` (used by poll page for season-linked polls)

### Expiry
- Existing daily cron `expire-tournament-applications` already covers poll-sourced applications (same `expires_at` logic)

## Files Changed

| File | Purpose |
|------|---------|
| `supabase/migrations/071_link_polls_to_seasons.sql` | New migration |
| `app/api/admin/polls/route.ts` | Accept `season_id` on create, join season on list |
| `app/(admin)/admin/polls/page.tsx` | Season dropdown in create form, fetch seasons |
| `app/api/polls/[share_code]/apply/route.ts` | Branch on `poll.season_id` → create tournament_application |
| `app/api/admin/tournament-applications/list/route.ts` | Join `poll_id` |
| `app/(admin)/admin/tournament-applications/page.tsx` | Select `poll_id` and pass to review shell |
| `app/(admin)/admin/tournament-applications/_review.tsx` | Display poll badge |
| `app/(public)/polls/[share_code]/page.tsx` | Fetch pickable teams for season-linked polls |
| `app/(public)/polls/[share_code]/PollClient.tsx` | Handle `isSeasonLinked` (status badge, no withdraw, different endpoint) |
| `app/(public)/polls/[share_code]/_desktop.tsx` | Same as PollClient |
| `app/(public)/polls/[share_code]/_mobile.tsx` | Same as PollClient |
| `app/api/tournament-applications/me/route.ts` | New endpoint for my tournament applications per season |

## Related Context
- `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md` — introduced `tournament_applications` and slot model; noted "polls-team import into slots" as deferred follow-up
- `.opencode/context/user-based-competitions/tournament-creation-user-slots-frontend_2026-09-02.md` — SeasonManager "Import from Poll" button (now redundant for season-linked polls)
- `.opencode/context/efootball-teams/polls-efootball-filter-type-fix_2026-08-16.md` — poll team filtering
- `.opencode/context/efootball-teams/polls-international-teams-empty_2026-08-25.md` — poll national team handling