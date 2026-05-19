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

## Summary Stats

| Category | Count |
|---|---|
| Pages created or rewritten | 8 |
| API routes created or updated | 7 |
| Components created | 5 |
| Bug fixes | 9 |
| Features shipped | 6 |

---

## Tech Stack

- **Framework:** Next.js 14 App Router (server + client components)
- **Database & Auth:** Supabase (SSR, row-level security, admin client)
- **Styling:** Tailwind CSS with custom design tokens
- **Deployment:** Vercel
- **Language:** TypeScript throughout
