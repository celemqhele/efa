-- Phone-number update flow: track which profile to update when the WhatsApp
-- number a manager texts from no longer matches their stored profile phone.
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS phone_update_profile_id uuid;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS phone_update_candidates jsonb;
