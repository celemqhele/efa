-- Processed messages table for deduplication
CREATE TABLE IF NOT EXISTS processed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Auto-cleanup old entries (older than 24 hours)
CREATE INDEX IF NOT EXISTS idx_processed_messages_created_at ON processed_messages(created_at);

-- Function to clean old messages
CREATE OR REPLACE FUNCTION clean_old_processed_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_messages WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every hour
SELECT cron.schedule(
  'clean-processed-messages',
  '0 * * * *',
  $$ SELECT clean_old_processed_messages(); $$
);