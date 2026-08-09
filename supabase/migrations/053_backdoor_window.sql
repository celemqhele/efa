-- Backdoor window toggle table.
-- Single-row settings table mirroring maintenance_mode: admins can open/close
-- the backdoor window via WhatsApp commands. When disabled, user backdoor
-- submissions are blocked with an explanatory message.
CREATE TABLE IF NOT EXISTS backdoor_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT true,
  enabled_by uuid REFERENCES profiles(id),
  enabled_at timestamptz,
  disabled_by uuid REFERENCES profiles(id),
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS ux_backdoor_window_single ON backdoor_window ((true));

-- RLS
ALTER TABLE backdoor_window ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backdoor window"
  ON backdoor_window FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read backdoor window"
  ON backdoor_window FOR SELECT
  USING (true);

-- Insert default row (window open by default)
INSERT INTO backdoor_window (enabled) VALUES (true)
ON CONFLICT DO NOTHING;

-- Grants: webhook writes/reads with service_role (bypasses RLS but needs grants);
-- dashboard admins read/manage via RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backdoor_window TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backdoor_window TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE backdoor_window TO authenticated;
