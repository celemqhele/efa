-- Fix missing grants on team_change_requests.
-- service_role only had REFERENCES/TRIGGER/TRUNCATE, so the admin team-change
-- route (app/api/admin/team-change/route.ts, which uses createAdminClient) failed
-- with "permission denied" on its SELECT, surfacing as "Request not found" in the
-- Pending Team Requests UI. The list view worked because it uses the user-session
-- client (authenticated role), which had grants.
-- Same pattern as migration 047 for backdoor_submissions.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE team_change_requests TO service_role;
