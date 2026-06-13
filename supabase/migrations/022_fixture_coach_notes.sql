CREATE TABLE IF NOT EXISTS fixture_coach_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id      uuid REFERENCES fixtures(id) ON DELETE CASCADE NOT NULL,
  team_id         uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  opponent_id     uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  confidence      text NOT NULL DEFAULT '-',
  opponent_will_exploit jsonb DEFAULT '[]'::jsonb,
  recommendations  jsonb DEFAULT '[]'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(fixture_id, team_id)
);

ALTER TABLE fixture_coach_notes ENABLE ROW LEVEL SECURITY;

-- Everyone can read coach notes
CREATE POLICY "Anyone can view fixture coach notes"
  ON fixture_coach_notes
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert fixture coach notes"
  ON fixture_coach_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update fixture coach notes"
  ON fixture_coach_notes
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete fixture coach notes"
  ON fixture_coach_notes
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
