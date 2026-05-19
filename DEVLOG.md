# EFA Platform — Dev Log

A full account of everything built and iterated on, from first commit to present.

---

## Phase 1 — White Theme Migration

**Problem:** The site had a dark navy background. The design needed to be light/white.

**What was done:**
- Rewrote `app/globals.css` with a full light theme — CSS variables for `--navy`, `--gold`, `--navy-card`, `--navy-border` all remapped to white/slate equivalents
- Updated `tailwind.config.ts` navy colour tokens to match
- Updated `components/ui/PageWrapper.tsx` to use the light background
- Ran a PowerShell bulk-replace pass across the entire codebase to swap hardcoded dark hex values (`#0a1128`, `#0f1a3d`, etc.) to their light equivalents
- Fixed invisible hover effects (`hover:bg-white/[0.03]` → `hover:bg-black/[0.03]`) that became invisible on a white background
- Manually fixed remaining `text-white` instances in conditional expressions across results, fixtures, hall-of-fame, and notification pages
- Preserved intentionally dark elements (broadcast graphics, PNG export card) by excluding them from bulk replacements

---

## Phase 2 — Select Team Redesign

**Problem:** New users registering were shown hundreds of real-world clubs from the logo registry to pick from, not just the clubs actually participating in the EFA league.

**What was done:**
- Rewrote `app/(auth)/select-team/page.tsx` to fetch clubs directly from the `teams` DB table instead of the logo registry
- Rewrote `SelectTeamClient.tsx` as a clean flat grid with "Available" and "Taken" sections
- Redesigned the claim API (`app/api/team/claim/route.ts`) to accept `team_id` instead of `folder/slug/name` — more reliable, works for clubs without logos

---

## Phase 3 — Three Auth/Session Bug Fixes

**Problems:**
1. New users got a "Profile not found" error when trying to claim a team after signup
2. After logging in, the nav sometimes still showed the logged-out state
3. Duplicate clubs appearing in the select-team page

**Fixes:**

**Middleware rewrite** (`middleware.ts`):
- Replaced the basic cookie-check middleware with a proper Supabase SSR implementation using `createServerClient` + `getUser()`
- `getUser()` actually validates the session with the Supabase server and rotates tokens, writing updated cookies back to the response — the old approach was just reading cookie names

**Register page** (`app/(auth)/register/page.tsx`):
- Changed `router.push('/select-team')` to `window.location.href = '/select-team'`
- Hard navigation ensures the browser sends fresh session cookies with the next request, so the select-team page sees the user as logged in immediately

**Claim API** (`app/api/team/claim/route.ts`):
- Added auto-creation of the `profiles` row from `user.user_metadata.username` if the DB trigger hadn't fired yet
- Fixed invalid `role: 'manager'` (not a valid enum value) → changed to `role: 'user'`

**Select-team deduplication** (`app/(auth)/select-team/page.tsx`):
- Added server-side deduplication by `logo_league_folder + logo_team_slug`
- For duplicates, prefers the row that already has a `manager_id` set

---

## Phase 4 — Absent / Forfeit Result Submission

**Problem:** Admins needed a way to record matches where one or both teams didn't show up, with correct points implications.

**Rules defined:**
- One team absent → auto 3–0 forfeit in favour of the present team, points awarded normally
- Both teams absent → 0–0, no points for either side
- Knockout (SF) + both absent → the best previously-eliminated group-stage team (ranked by points → GD → GF) fills the winner's bracket slot

**What was done:**

**ResultSubmitClient.tsx:**
- Added `homeAbsent` / `awayAbsent` checkboxes in the Score card
- When a team is marked absent, scores auto-fill (0–3, 3–0, or 0–0) and score inputs lock
- Absent flags sent alongside the rest of the payload
- OCR screenshot upload still works — absent flags override the score after parsing
- Submit button and validation updated to handle the absent flow

**`/api/admin/finalise-result`:**
- Parses `home_absent` / `away_absent` flags
- Enforces correct forfeit scores server-side regardless of what the client sends
- Skips standings update entirely when both teams are absent (0–0, no points)
- For SF + both absent: queries `group_standings`, filters out teams already in SF fixtures, sorts remaining by points → GD → GF, and calls `fillFinalSlot` with the best eliminated team
- Notifications distinguish between voided, forfeit, and normal results
- Audit log records absent flags alongside scores

---

## Phase 5 — Logged-In State After Signup (No Team Yet)

**Problem:** If a user registered but hadn't claimed a team yet, they appeared logged out on every page because the `profiles` DB row didn't exist yet (trigger timing), so `PageWrapper` returned null and the nav showed Login/Register.

**Fix (`components/ui/PageWrapper.tsx`):**
- When `user` is authenticated but `profiles` query returns null, synthesize a stub profile from session metadata (`user.user_metadata.username`, `role: 'user'`, `avatar_url: null`)
- Nav now always shows the logged-in state for any authenticated user, even before they've completed onboarding

---

## Phase 6 — Cross-Phase Manager Propagation

**Problem:** When an admin adds the same real-world club to a new phase, it creates a new row in the `teams` table. If a user claimed "their" Fulham (one row), the Fulham in Phase 2 (different row, same club) still showed no manager.

**Fix (`app/api/team/claim/route.ts`):**
- After a user claims a team, the API now finds all other `teams` rows with the same `logo_league_folder + logo_team_slug`
- Checks none of the sibling rows are already claimed by someone else
- Sets `manager_id = user.id` on **all** sibling rows in one update
- Opens manager tenures for all sibling rows

---

## Phase 7 — Manage Managers Admin Feature

**Decision:** Instead of trying to patch data every time a new phase adds clubs, build admin tooling that makes the issue irrelevant.

**New page: `/admin/managers`** (linked from the dashboard header):

- Shows all league clubs as a grid, deduplicated by logo slug
- Green dot = has a manager (shows username), grey = vacant
- Click any club to open the detail panel

**Detail panel:**
- If managed: shows current manager's avatar + name + a **Remove** button
- If vacant: scrollable list of all users split into Available (clickable) and Already managing a club (greyed out, "sack first" label)
- UI updates in place without page reload

**New API routes:**
- `POST /api/admin/managers/assign` — assigns a user to a team; blocks if they already manage another club; propagates to all sibling rows; updates avatar; opens tenures; logs to audit_log
- `POST /api/admin/managers/sack` — clears `manager_id` on all sibling rows; closes tenures; logs to audit_log

---

## Phase 8 — Team Profile + Standings UX

**Problems:**
1. "View" button on tournament cards linked to `/tournaments/[id]` — page didn't exist
2. You couldn't click any team in the standings to see their profile
3. The dedicated Manage Managers page didn't solve the cross-phase problem cleanly for existing phases already in progress

**Fixes:**

**Tournament View button** (`app/(admin)/admin/tournaments/page.tsx`):
- Changed href from `/tournaments/${id}` → `/standings?t=${id}`, which loads the public standings page filtered to that tournament

**Clickable standings rows** (`app/(public)/standings/page.tsx`):
- League table rows: team name now wrapped in `<Link href="/teams/{id}">`, turns gold on hover
- Group stage rows: same treatment
- Both navigate to the existing team profile page at `/teams/[id]`

**Admin manager controls on team profile** (`app/(public)/teams/[id]/`):
- Server page checks if the current user is an admin
- If yes, fetches all profiles and the managed-team map
- Renders a new `TeamManagerAdmin` client component directly on the team profile page
- **Has manager**: shows avatar + username + **Sack** button
- **Vacant**: same available/busy user list as the admin panel
- Calls the existing sack/assign APIs
- This means admins can manage any team's manager from the public league table — existing phases included

---

## Phase 9 — Admin-Assign Not Syncing to Profile/Home

**Problem:** After an admin assigned a manager via the admin UI, the assigned user's profile still showed "Select Club" and their home page showed all fixtures (not just their team's), as if they had no team at all.

**Root cause:** Both `app/page.tsx` and `app/(protected)/profile/page.tsx` used Supabase's `.maybeSingle()` to find the user's team. This silently returns `null` whenever **more than one row** matches — which happens when the unique constraint on `manager_id` is dropped and the same user has `manager_id` set on multiple sibling team rows (same club across different phases). The result: profile shows "No team selected" and home page shows all fixtures.

**Secondary cause:** The fixture queries used a single team row's `id` for filtering. If a user manages multiple sibling rows (e.g., Fulham in Phase 1 and Phase 2), only one row's fixtures were shown — missing the active tournament's fixtures if they were on the other row.

**Tertiary cause:** The assign API blocked assigning a user who already manages a sibling of the same club (e.g., User manages Phase 2 Fulham, admin tries to assign to Phase 1 Fulham) with "already manages that team — sack first."

**Fixes:**

**`app/page.tsx`:**
- Changed `.eq('manager_id', user.id).maybeSingle()` → fetch all matching rows (no limit), take first for display
- Built `userTeamIds` array of all the user's team row IDs
- Fixture queries now use an OR filter covering all team IDs across phases, not just one

**`app/(protected)/profile/page.tsx`:**
- Same `.maybeSingle()` → fetch-all-limit-none fix
- `teamOrFilter` OR-filter built from all `teamIds` for the upcoming fixtures query
- "Is home game?" check changed from `f.home_team?.id === team.id` to `teamIds.includes(f.home_team?.id)` to correctly identify home vs away across all phase rows

**`app/api/admin/managers/assign/route.ts`:**
- Changed `existingTeam` check from single-row `.single()` to fetching all rows the user manages
- If all existing rows are siblings of the target team (same `logo_league_folder` + `logo_team_slug`), allow the assignment — propagation will fill the remaining sibling rows
- Only blocks if user manages a completely different club

**DB prerequisite (still required if not done):**
```sql
ALTER TABLE teams DROP CONSTRAINT teams_manager_id_key;
```
Without this, the assign API cannot set the same `manager_id` on multiple sibling rows (blocked by the unique constraint).

---

## Phase 10 — Constraint Clarification + Auto-Sack Tracker

**Problem 1:** Attempted to drop `teams_manager_id_key` unique constraint, but it didn't exist — so this was never the blocker. The assign-sync issue was purely the `maybeSingle()` bug (Phase 9 fix).

**Problem 2:** No automated consequence for teams that repeatedly no-show — admins had to manually monitor and sack.

**Feature: Auto-sack on 4 consecutive absences**

**How it works:**
- Every time a result is finalised with `home_absent` or `away_absent`, the absent team's `abandon_count` is incremented in the DB
- Immediately after, `checkAndAutoSack()` runs for each absent team
- It queries the team's last 4 confirmed results (via `scheduled_date DESC`) and checks if EVERY result was an absence for that team:
  - "Both absent" results count for both teams
  - Single-absent is detected by the forfeit score pattern (0–3 for home, 3–0 for away) combined with `override_reason` containing "absent"
- If all 4 were absences → auto-sack fires:
  1. Clears `manager_id` on all sibling rows (same club across phases)
  2. Closes all open `manager_tenures`
  3. Sends an in-app notification to the sacked manager
  4. Writes an `auto_sack_manager` entry to `audit_log`
- If the team has fewer than 4 confirmed results total, no check fires (can't trigger prematurely)

**Files changed:**
- `app/api/admin/finalise-result/route.ts`: Added `checkAndAutoSack()` helper before standings helpers; added absence tracking block after result insert that increments `abandon_count` and calls `checkAndAutoSack()` inside a non-fatal try/catch

---

## Phase 11 — Manager Application Feature

**Feature:** Any logged-in user can apply to manage any club in the league — including clubs that already have a manager. If an admin approves, the current manager is sacked and the applicant is appointed.

**DB migration required:**
```sql
CREATE TABLE manager_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id)
);
```

**User flow:**
- User visits any team profile page (`/teams/[id]`)
- If logged in and not already the manager of that club, they see a "Management Application" card
- If the club already has a manager, the card says so and explains the current manager will be replaced on approval
- Clicking "Apply to Manage" submits the application (one pending application per user at a time)
- Button state changes to "Application pending — awaiting admin review"

**Admin flow:**
- `/admin/users/manage` shows a new "Manager Applications" section (above team change requests)
- Columns: Applicant, Wants to Manage (with logo), Current Manager (or Vacant), Date, Approve/Deny
- Approve: sacks any current manager of the club (clears manager_id on all sibling rows, closes tenures, notifies the sacked manager); if applicant already manages a different club, sacks them from that first; assigns applicant to all sibling rows; opens tenures; notifies applicant; denies other pending applications for the same club
- Deny: marks as denied, notifies applicant
- Both actions use `router.refresh()` to update the list in place

**New files:**
- `app/api/teams/apply-manager/route.ts`
- `app/api/admin/manager-applications/approve/route.ts`
- `app/api/admin/manager-applications/deny/route.ts`
- `components/ui/ApplyManagerButton.tsx`
- `components/ui/ManagerApplicationButtons.tsx`

**Modified files:**
- `app/(public)/teams/[id]/page.tsx` — added `hasPendingApplication` check + `ApplyManagerButton` section
- `app/(admin)/admin/users/manage/page.tsx` — added manager applications table

---

## Summary Stats

| Category | Count |
|---|---|
| Pages created or rewritten | 8 |
| API routes created or updated | 11 |
| Components created | 7 |
| Bug fixes | 13 |
| Features shipped | 8 |

---

## Tech Stack

- **Framework:** Next.js 14 App Router (server + client components)
- **Database & Auth:** Supabase (SSR, row-level security, admin client)
- **Styling:** Tailwind CSS with custom design tokens
- **Deployment:** Vercel
- **Language:** TypeScript throughout
