-- Grants for maintenance_mode and cached_messages.
-- The webhook writes/reads these with service_role (which bypasses RLS but
-- still needs table grants); dashboard admins read/manage via RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE maintenance_mode TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE maintenance_mode TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE maintenance_mode TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cached_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cached_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cached_messages TO authenticated;
