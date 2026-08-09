-- Team aliases table
CREATE TABLE IF NOT EXISTS team_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, alias)
);

CREATE INDEX idx_team_aliases_alias ON team_aliases(lower(alias));
CREATE INDEX idx_team_aliases_team_id ON team_aliases(team_id);

ALTER TABLE team_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team_aliases"
  ON team_aliases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read team_aliases"
  ON team_aliases FOR SELECT
  USING (true);