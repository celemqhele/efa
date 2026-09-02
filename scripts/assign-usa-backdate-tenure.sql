-- One-off: assign TbhoTouch as USA manager and backdate his tenure to start
-- before the 2 most recent confirmed USA matches (EFA International Cup) so
-- that both matches count toward his manager stats.
--
--   * USA team          : 7a77ac86-7deb-4be6-b50a-d60819ac07c9
--   * TbhoTouch profile : d692dd4f-0a04-4ee6-95eb-c0369af7a6c1
--   * 2 recent matches  : 2026-08-28  USA 6-2 GER  (home win)
--                        2026-08-29  BEL 1-2 USA  (away win)

DO $$
DECLARE
  v_team_id      uuid := '7a77ac86-7deb-4be6-b50a-d60819ac07c9';
  v_manager_id   uuid := 'd692dd4f-0a04-4ee6-95eb-c0369af7a6c1';
  v_username     text := 'tbhotouch';
  v_backdate     timestamptz := '2026-08-28T20:00:00Z';
  v_tenure_id    uuid;
  v_row          record;
BEGIN
  -- 1. Assign USA team to TbhoTouch
  UPDATE teams
  SET manager_id = v_manager_id
  WHERE id = v_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USA team not found';
  END IF;

  -- 2. Insert a backdated (open-ended) tenure covering the last 2 USA matches
  INSERT INTO manager_tenures
    (team_id, manager_id, manager_username, started_at, ended_at)
  VALUES
    (v_team_id, v_manager_id, v_username, v_backdate, NULL)
  RETURNING id INTO v_tenure_id;

  -- 3. Recalc stats for the new tenure so the 2 backdated matches count
  PERFORM recalc_tenure_stats(v_tenure_id);

  -- 4. Report the resulting tenure
  SELECT mt.id, mt.team_id, t.name AS team, mt.manager_username,
         mt.started_at, mt.ended_at, mt.wins, mt.draws, mt.losses,
         mt.goals_for, mt.goals_against
    INTO v_row
    FROM manager_tenures mt
    JOIN teams t ON t.id = mt.team_id
   WHERE mt.id = v_tenure_id;

  RAISE NOTICE 'Tenure id: %', v_tenure_id;
  RAISE NOTICE 'Team: % (manager: %)', v_row.team, v_row.manager_username;
  RAISE NOTICE 'started_at: %  ended_at: %', v_row.started_at, v_row.ended_at;
  RAISE NOTICE 'W-D-L: %-%-%  GF-GA: %-%', v_row.wins, v_row.draws, v_row.losses, v_row.goals_for, v_row.goals_against;

  -- 5. Verify the 2 recent matches are counted (Germany + Belgium)
  IF v_row.wins <> 2 OR v_row.draws <> 0 OR v_row.losses <> 0 OR
     v_row.goals_for <> 8 OR v_row.goals_against <> 3 THEN
    RAISE EXCEPTION 'Unexpected stats after backdate: W-D-L=%-%-% GF-GA=%-%',
      v_row.wins, v_row.draws, v_row.losses, v_row.goals_for, v_row.goals_against;
  END IF;

  RAISE NOTICE 'Verified: USA stats applied to tenure (2 wins, 8-3 aggregate).';
END $$;
