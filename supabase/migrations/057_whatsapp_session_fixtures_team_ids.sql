-- Check-fixtures auto-detect: store all team ids a manager owns so the bot can
-- list fixtures across every team managed by the recognized WhatsApp number.
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS fixtures_team_ids jsonb;
