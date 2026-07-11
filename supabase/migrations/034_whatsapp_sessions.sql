CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone_number text PRIMARY KEY,
  state text NOT NULL DEFAULT 'idle',
  home_team text,
  away_team text,
  home_score integer,
  away_score integer,
  match_stats jsonb,
  matched_fixture_id uuid REFERENCES fixtures(id),
  screenshot_media_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rc_unique_fixture_submitted'
  ) THEN
    ALTER TABLE result_confirmations ADD CONSTRAINT rc_unique_fixture_submitted UNIQUE (fixture_id, submitted_by);
  END IF;
END $$;
