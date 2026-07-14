ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS pending_date text DEFAULT NULL;
