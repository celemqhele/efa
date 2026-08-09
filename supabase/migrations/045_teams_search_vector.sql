-- Full-text search vector on teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_teams_search_vector 
  ON teams USING gin(search_vector);

CREATE OR REPLACE FUNCTION update_team_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.logo_league_folder, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_search_vector ON teams;
CREATE TRIGGER update_team_search_vector
  BEFORE INSERT OR UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_team_search_vector();

-- Populate existing teams
UPDATE teams SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(logo_league_folder, '')), 'B');