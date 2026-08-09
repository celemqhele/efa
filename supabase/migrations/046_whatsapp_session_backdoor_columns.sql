-- Add backdoor session fields to whatsapp_sessions (idempotent)
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS backdoor_fixture_ids jsonb;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS backdoor_submission_id text;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS backdoor_side text;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS backdoor_menu_step text;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS backdoor_screenshot_media_id text;
