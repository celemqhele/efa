-- EFA Platform — Manual Team DNA Assignment
-- Replaces auto-calculation with AI-managed playstyle assignments

CREATE TABLE IF NOT EXISTS team_dna (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade unique not null,
  primary_profile text not null,
  primary_level text not null,
  primary_score real default 0,
  secondary_profile text,
  secondary_level text,
  secondary_score real default 0,
  tertiary_profile text,
  tertiary_level text,
  tertiary_score real default 0,
  updated_by uuid references profiles(id),
  notes text,
  updated_at timestamptz default now()
);

-- Allow reads by any authenticated user (public display)
DROP POLICY IF EXISTS "team_dna_select_anyone" ON team_dna;
CREATE POLICY "team_dna_select_anyone"
  ON team_dna FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update
DROP POLICY IF EXISTS "team_dna_insert_admin" ON team_dna;
CREATE POLICY "team_dna_insert_admin"
  ON team_dna FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "team_dna_update_admin" ON team_dna;
CREATE POLICY "team_dna_update_admin"
  ON team_dna FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Enable RLS
ALTER TABLE team_dna ENABLE ROW LEVEL SECURITY;
