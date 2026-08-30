-- 067: Vacant-slot default results sweep
--
-- Vacant slots (tournament seats with no owner) keep playing: an hourly cron
-- auto-saves the default result for any scheduled, past-due league/group
-- fixture whose side is the Vacant placeholder team:
--   * Vacant home  -> 0-3 (Vacant absent, opponent wins)
--   * Vacant away  -> 3-0 (Vacant absent, opponent wins)
--   * Both vacant  -> 0-0 void, no points for either seat
--
-- The insert flows through update_standings_after_result() (migration 066) so
-- standings/group_standings are keyed by participant as usual. Results are
-- written with is_abandoned = false and an 'absent' override reason so the
-- Vacant placeholder's abandon_count is never incremented and the live opponent
-- is never flagged as absent.

CREATE OR REPLACE FUNCTION public.sweep_vacant_slots()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vacant_team uuid;
  v_count int := 0;
  v_fx record;
  v_home_vacant boolean;
  v_away_vacant boolean;
  v_home_score int;
  v_away_score int;
  v_reason text;
BEGIN
  SELECT id INTO v_vacant_team FROM teams
  WHERE logo_league_folder = 'custom' AND logo_team_slug = 'vacant'
  LIMIT 1;

  IF v_vacant_team IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_fx IN
    SELECT f.id, f.home_team_id, f.away_team_id
    FROM fixtures f
    WHERE f.status = 'scheduled'
      AND f.scheduled_date IS NOT NULL
      AND f.scheduled_date <= now()
      AND f.round_type IN ('league', 'group')
      AND (f.home_team_id = v_vacant_team OR f.away_team_id = v_vacant_team)
      AND NOT EXISTS (SELECT 1 FROM results r WHERE r.fixture_id = f.id)
  LOOP
    v_home_vacant := (v_fx.home_team_id = v_vacant_team);
    v_away_vacant := (v_fx.away_team_id = v_vacant_team);

    IF v_home_vacant AND v_away_vacant THEN
      v_home_score := 0;
      v_away_score := 0;
      v_reason := 'Both slots vacant and absent — void (0-0)';
    ELSIF v_home_vacant THEN
      v_home_score := 0;
      v_away_score := 3;
      v_reason := 'Vacant slot absent — automatic 0-3';
    ELSE
      v_home_score := 3;
      v_away_score := 0;
      v_reason := 'Vacant slot absent — automatic 3-0';
    END IF;

    INSERT INTO results (
      fixture_id, home_score, away_score, finalised_by,
      screenshot_url, override_reason,
      is_abandoned, abandoned_type, pen_home_score, pen_away_score
    ) VALUES (
      v_fx.id, v_home_score, v_away_score, NULL,
      NULL, v_reason,
      false, NULL, NULL, NULL
    )
    ON CONFLICT (fixture_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_vacant_slots() TO service_role;

-- Hourly sweep so vacant seats keep their fixtures moving at matchday deadlines
DO $$
BEGIN
  PERFORM cron.unschedule('sweep-vacant-slots');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sweep-vacant-slots',
  '0 * * * *',
  $$SELECT public.sweep_vacant_slots()$$
);