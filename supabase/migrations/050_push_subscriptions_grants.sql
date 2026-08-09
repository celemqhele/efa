-- Grant service_role access to push_subscriptions.
-- The table was created without default grants, so service_role (used by admin
-- push broadcast and notification cron) could not read subscription rows.
-- This broke admin push-broadcast (returned subscribed: 0) and any sendPushToUsers
-- calls that read subscriptions via the service-role client.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_subscriptions TO authenticated;
