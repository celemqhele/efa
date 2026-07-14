-- Admin result notification trigger
-- Fires when a fixture's status changes to 'confirmed'
-- Inserts in-app notifications for all admin users
-- Wrapped in EXCEPTION block so notification failures never roll back the UPDATE

CREATE OR REPLACE FUNCTION notify_admin_on_fixture_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
  v_admin_id uuid;
BEGIN
  -- Only fire when transitioning TO 'confirmed'
  IF OLD.status = 'confirmed' OR NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Get result + team names
  SELECT r.home_score, r.away_score,
         ht.name as home_name, at.name as away_name
  INTO v_result
  FROM results r
  JOIN teams ht ON ht.id = NEW.home_team_id
  JOIN teams at ON at.id = NEW.away_team_id
  WHERE r.fixture_id = NEW.id;

  IF NOT FOUND OR v_result IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification for each admin
  -- Wrapped in EXCEPTION so a notifications failure never blocks the fixture update
  BEGIN
    FOR v_admin_id IN
      SELECT id FROM profiles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_admin_id,
        'result_confirmed',
        'Result Confirmed',
        v_result.home_name || ' ' || v_result.home_score || '–' || v_result.away_score || ' ' || v_result.away_name,
        jsonb_build_object(
          'fixture_id', NEW.id,
          'home_score', v_result.home_score,
          'away_score', v_result.away_score
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to insert admin notification for fixture %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS on_fixture_confirmed ON fixtures;
CREATE TRIGGER on_fixture_confirmed
  AFTER UPDATE ON fixtures
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_fixture_confirmed();
