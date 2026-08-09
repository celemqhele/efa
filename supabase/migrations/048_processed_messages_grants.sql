-- Fix missing grants on processed_messages (dedup table).
-- The table was created without grants, so service_role's dedup INSERT failed
-- with 42501 ("permission denied"), meaning every duplicate webhook delivery was
-- processed again. This caused repeated "Which fixture?" / OCR prompts for a
-- single screenshot.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE processed_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE processed_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE processed_messages TO authenticated;
