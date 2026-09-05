# Disqualify vs Sack split on team page

## Summary
The team page now offers two distinct admin actions instead of one: **Sack** (full removal from the club, existing behavior) and **Disqualify** (tournament-only: vacates the manager's tournament seat(s) but keeps them as the club's manager). Previously the single Sack button did both, which contradicts the seat model where a club and its tournament seats are separate concepts.

## Problem
Session goal is the vacant-seat takeover flow from `.opencode/context/user-based-competitions/vacant-seat-manager-takeover_2026-09-05.md` (assign manager → Vacant placeholder fills the seat with their real club, inheriting seat stats). During that work, `app/(public)/teams/[id]/TeamManagerAdmin.tsx` had only a "Sack" button that called `/api/admin/managers/sack`, which clears `teams.manager_id`, closes tenures, stamps `profiles.sacked_at`, AND vacates tournament seats. User clarified the semantics: assigning to Vacant must not depend on a full sack, and the team page should not have a single mixed action — there should be two separate options:

- **Sack** if the team has a manager (full removal — for user-management flows).
- **Disqualify** if the team is in a tournament (vacate the seat only, manager keeps the club).
- **Both** if both apply.

## Fix
1. **New route `app/api/admin/managers/disqualify/route.ts`** — for the team page's Disqualify action. It:
   - Admin-gated (same as sack route).
   - Finds the team, requires a manager.
   - Calls only `vacateUserSlots(adminSupabase, managerUserId)` — the seat keeps its standings continuity and is shown as Vacant.
   - Does **NOT** clear `teams.manager_id`, does **NOT** close tenures, does **NOT** set `profiles.sacked_at` (no 7-day reassignment cooldown — the manager stays bound to the club).
   - Sends a `disqualification` notification ("your tournament seat was vacated, you remain the club's manager") and writes an `audit_log` entry with `action: 'disqualify_manager'`.
2. **`app/(public)/teams/[id]/TeamManagerAdmin.tsx`** — now renders both buttons in the manager card: Sack (red, calls `/managers/sack`, clears manager state) and Disqualify (orange, calls `/managers/disqualify`, visible only when `inTournament`, keeps the manager card and shows an orange success notice about vacated seats).
3. **`app/(public)/teams/[id]/page.tsx`** — computes `inTournament` (the club holds a seat in an active tournament) by querying `tournament_participants.team_id` across all sibling team rows, then checking those tournaments are `active`. Passes it in the data payload.
4. **`_desktop.tsx` / `_mobile.tsx`** — destructure `inTournament` from `data` and pass to `<TeamManagerAdmin>`.

## Consumers
- `/api/admin/managers/sack` remains the **full removal** endpoint and is untouched. It is still called by:
  - `TeamManagerAdmin.tsx` (Sack button in the manager card).
  - `.opencode/context/user-based-competitions/` reference: `app/(admin)/admin/users/manage/ManagersClient.tsx` (user-management sack).
- `scripts/migrate-manager-stats.ts` still reads `sack_manager` / `auto_sack_manager` actions; the new `disqualify_manager` action is intentionally NOT in its mapping (disqualification must not count as removing the manager or closing tenures).

## Dev notes
- `npx tsc --noEmit` passes for the new route and team-page changes; `next lint` only shows the pre-existing `_mobile.tsx` unused-type-import warnings.
- No DB changes needed (uses existing `tournament_participants`, `tournaments`).