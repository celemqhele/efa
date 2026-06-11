-- Auto-update manager_tenures stats when results are inserted/updated

CREATE OR REPLACE FUNCTION recalc_tenure_stats(p_tenure_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE manager_tenures mt
  SET
    wins = COALESCE(sub.wins, 0),
    draws = COALESCE(sub.draws, 0),
    losses = COALESCE(sub.losses, 0),
    goals_for = COALESCE(sub.gf, 0),
    goals_against = COALESCE(sub.ga, 0)
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE
        (f.home_team_id = mt2.team_id AND r.home_score > r.away_score) OR
        (f.away_team_id = mt2.team_id AND r.away_score > r.home_score)
      ) AS wins,
      COUNT(*) FILTER (WHERE r.home_score = r.away_score) AS draws,
      COUNT(*) FILTER (WHERE
        (f.home_team_id = mt2.team_id AND r.home_score < r.away_score) OR
        (f.away_team_id = mt2.team_id AND r.away_score < r.home_score)
      ) AS losses,
      SUM(CASE WHEN f.home_team_id = mt2.team_id THEN r.home_score ELSE r.away_score END) AS gf,
      SUM(CASE WHEN f.home_team_id = mt2.team_id THEN r.away_score ELSE r.home_score END) AS ga
    FROM manager_tenures mt2
    JOIN fixtures f ON (f.home_team_id = mt2.team_id OR f.away_team_id = mt2.team_id)
    JOIN results r ON r.fixture_id = f.id
    WHERE mt2.id = p_tenure_id
      AND f.status IN ('confirmed', 'abandoned_home', 'abandoned_away', 'abandoned_both')
      AND f.scheduled_date >= mt2.started_at
      AND (mt2.ended_at IS NULL OR f.scheduled_date <= mt2.ended_at)
  ) sub
  WHERE mt.id = p_tenure_id;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_recalc_on_result()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_fixture fixtures%ROWTYPE;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE id = NEW.fixture_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM recalc_tenure_stats(mt.id)
  FROM manager_tenures mt
  WHERE mt.team_id IN (v_fixture.home_team_id, v_fixture.away_team_id)
    AND mt.started_at <= v_fixture.scheduled_date
    AND (mt.ended_at IS NULL OR mt.ended_at >= v_fixture.scheduled_date);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_result_for_manager_stats ON results;
CREATE TRIGGER on_result_for_manager_stats
  AFTER INSERT OR UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_on_result();
