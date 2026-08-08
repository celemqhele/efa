-- Maintenance mode table
CREATE TABLE IF NOT EXISTS maintenance_mode (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT false,
  message text DEFAULT 'We are currently under maintenance. Please send your screenshot again in 2-3 hours.',
  enabled_by uuid REFERENCES profiles(id),
  enabled_at timestamptz,
  disabled_by uuid REFERENCES profiles(id),
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS ux_maintenance_mode_single ON maintenance_mode ((true));

-- RLS
ALTER TABLE maintenance_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage maintenance mode"
  ON maintenance_mode FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read maintenance mode"
  ON maintenance_mode FOR SELECT
  USING (true);

-- Insert default row
INSERT INTO maintenance_mode (enabled, message) VALUES (false, 'We are currently under maintenance. Please send your screenshot again in 2-3 hours.')
ON CONFLICT DO NOTHING;

-- Cached messages table (for messages received during maintenance)
CREATE TABLE IF NOT EXISTS cached_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  message_type text NOT NULL, -- 'text' | 'image'
  content jsonb NOT NULL, -- full message payload
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cached_messages_phone ON cached_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_cached_messages_created ON cached_messages(created_at);

-- RLS
ALTER TABLE cached_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cached messages"
  ON cached_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));