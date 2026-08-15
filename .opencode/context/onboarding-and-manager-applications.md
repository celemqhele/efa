# WhatsApp Onboarding + Admin Manager-Assignment

## Problem
New players couldn't join EFA from WhatsApp, and admins had to manage manager applications from the web app only. Additionally, the app's notifications-page Approve/Deny buttons for team change requests silently swallowed API errors ("spinner, then nothing") and left the "Approve?" notifications in the feed forever.

## Onboarding flow (any user)
User texts `apply` (or `apply to join`, `join efa`, `i want to join`, `i want to apply`):
1. `handleOnboardingStart` — if the texting phone already maps to a `profiles` row (`whatsapp_number` or `phone`), reply "You already have an EFA account". Otherwise set `state='awaiting_onboarding_username'` and ask for a username.
2. `handleOnboardingUsername` — validates 3–30 chars `[a-z0-9_]`, checks uniqueness, then:
   - `supabase.auth.admin.createUser({ email: <username>@efa.local, password: 'Efootball@2026', email_confirm: true, user_metadata: { username } })` (the `on_auth_user_created` trigger auto-creates the profile; profile inserted defensively if absent, `whatsapp_number` synced).
   - Inserts a **team-less** `manager_applications` row (`team_id = null`, `status='pending'`, `expires_at = now + 7 days`).
   - Sends welcome: login link (`https://efa-fxyk.vercel.app/login`), default password, WhatsApp group link (`https://chat.whatsapp.com/FPk19G6cr9D4dDE07HHC7T`).

## Admin flow (admin-only)
Admin texts `manager applications` (or `manager apps`):
1. `handleManagerApplicationsStart` — lists **pending, not-yet-expired** applications (numbered, `@username` + target team or "(no team yet)"), stores them in `session.admin_assign_applicants`, `state='awaiting_admin_assign_applicant'`.
2. `handleManagerApplicationsApplicant` — admin picks a number → `getTeamsForAssignment` returns the team list (active-tournament participants + teams that lost via approved backdoor in the last 7 days, deduped, alpha-sorted, capped 30), stored in `admin_assign_team_list`, `state='awaiting_admin_assign_team'`.
3. `handleManagerApplicationsTeam` — admin picks a team → confirm prompt (`state='awaiting_admin_assign_confirm'`).
4. `handleManagerApplicationsConfirm` — on `yes`, `applyManagerAssignment` runs:
   - Enforces the 7-day sack cooldown (`profiles.sacked_at`).
   - Releases the applicant's previous clubs (closes open `manager_tenures`, nulls `teams.manager_id`).
   - Closes the target club's open tenures (all sibling rows by `logo_league_folder`+`logo_team_slug`), sets `manager_id`, opens new tenures.
   - Marks the application approved with `team_id` + `reviewed_by` (admin resolved from phone via `getAdminProfileIdByPhone`), denies the applicant's other pending apps and other apps for the same team.
   - Notifies the new manager (`application_approved`) and the replaced manager (`manager_sacked`), writes `audit_log`.
   - `CANCEL` / `no` exits at any step.

## Bug fix: notifications-page Approve/Deny
- Root cause: `TeamChangeRequestRow.act` (and `AdminNotificationsClient.handleRequest`) used `try/finally` with no `catch` and never read the error body, so any failed `/api/admin/team-change` call looked like "nothing happened".
- Fix: both clients now surface the API error inline; `app/api/admin/team-change/route.ts` checks write errors (returns 500 with the message), wraps the handler in try/catch, and **deletes** the `team_request` notifications matching the reviewed request (`data->>requesting_user_id` + `data->>requested_team_id`) for all admins instead of just marking them read — so they actually go away.

## Key files
- `app/api/webhook/route.ts`: new `SessionData` fields (`onboarding_username`, `admin_assign_applicants`, `admin_assign_team_list`, `admin_assign_selected_applicant_id`, `admin_assign_selected_team_id`); new states `awaiting_onboarding_username`, `awaiting_admin_assign_applicant`, `awaiting_admin_assign_team`, `awaiting_admin_assign_confirm`; handlers added before the Forfeit flow section; command intercepts in `handleText` before the LLM fallback.
- `supabase/migrations/058_onboarding_and_admin_assign.sql`: `manager_applications.team_id` nullable, `expires_at` column (+backfill), status check now includes `'expired'`, daily cron `expire-manager-applications`, new `whatsapp_sessions` columns.
- `app/(protected)/notifications/NotificationActions.tsx`, `app/(admin)/admin/notifications/AdminNotificationsClient.tsx`: error surfacing.
- `app/api/admin/team-change/route.ts`: write-error checks + notification deletion.
- `app/(admin)/admin/users/manage/_desktop.tsx`/`_mobile.tsx` + `components/ui/ManagerApplicationButtons.tsx`: team-less applications show "Waiting for team — assign via WhatsApp" and the Approve button is disabled until a team is set.

## Verified
- `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- Migration `058` applied to live Supabase; cron scheduled; status check widened; `expires_at` backfilled.
- Live DB checks confirmed all tables/constraints referenced by the fixed route exist (see `058` + `team-change/route.ts`).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
