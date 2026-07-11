CREATE TABLE IF NOT EXISTS manager_pins (
  phone_number text NOT NULL,
  team_id uuid REFERENCES teams(id) NOT NULL,
  pin_hash text NOT NULL,
  failed_attempts int DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (phone_number, team_id)
);

ALTER TABLE manager_pins ENABLE ROW LEVEL SECURITY;

ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
