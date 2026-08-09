-- Fix missing grants on backdoor_submissions.
-- The table was created without default grants, so service_role (used by the
-- webhook) and anon/authenticated lack SELECT/INSERT/UPDATE/DELETE. This broke
-- every backdoor DB operation: duplicate check, insert, list applications,
-- admin review list, and approve/decline decisions.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backdoor_submissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backdoor_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backdoor_submissions TO authenticated;
