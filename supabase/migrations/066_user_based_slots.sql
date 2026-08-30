-- ============================================================
-- 066 — User-based (slot-owned) competitions
-- ============================================================
-- The atomic unit of a competition becomes the SLOT (a
-- tournament_participants row) owned by a USER. The team shown is
-- an attribute that follows the owner:
--
--   * tournament_participants.user_id  — who occupies the slot (NULL = vacant)
--   * tournament_participants.team_id  — the display club (Vacant placeholder when ownerless)
--   * standings / group_standings      — re-keyed to participant_id so a slot's
--                                        running record never moves between teams
--   * fixtures                         — gain per-side participant refs so result
--                                        resolution is unambiguous even if the same
--                                        club appears twice in one competition
--
-- Also adds the season-scoped tournament_applications table (apply
-- to a SEASON seat, bringing a club), grants, RLS and an expiry cron.

-- ─────────────────────────────────────────────────────────────
-- 1) Vacant placeholder team
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.teams (name, logo_league_folder, logo_team_slug, manager_id, abandon_count)
SELECT 'Vacant', 'custom', 'vacant', NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.teams WHERE logo_league_folder = 'custom' AND logo_team_slug = 'vacant'
);

-- ─────────────────────────────────────────────────────────────
-- 2) tournament_participants.user_id (slot owner)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id);

-- A user can occupy at most one slot per tournament
CREATE UNIQUE INDEX IF NOT EXISTS tournament_participants_tournament_user_unique
  ON public.tournament_participants (tournament_id, user_id)
  WHERE user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3) standings / group_standings / fixtures slot-columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.standings
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.tournament_participants(id);
ALTER TABLE public.group_standings
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.tournament_participants(id);

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS home_participant_id uuid REFERENCES public.tournament_participants(id);
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS away_participant_id uuid REFERENCES public.tournament_participants(id);

-- ─────────────────────────────────────────────────────────────
-- 4) Backfill slot owners from the live manager binding
-- ─────────────────────────────────────────────────────────────
UPDATE public.tournament_participants tp
SET user_id = t.manager_id
FROM public.teams t
WHERE t.id = tp.team_id
  AND tp.user_id IS NULL
  AND t.manager_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 5) Data repair: slots for any team that has standings/fixtures
--    activity but no participant row yet
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.tournament_participants (tournament_id, team_id)
SELECT DISTINCT s.tournament_id, s.team_id
FROM public.standings s
WHERE s.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = s.tournament_id AND tp.team_id = s.team_id
  );

INSERT INTO public.tournament_participants (tournament_id, team_id)
SELECT DISTINCT gs.tournament_id, gs.team_id
FROM public.group_standings gs
WHERE gs.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = gs.tournament_id AND tp.team_id = gs.team_id
  );

INSERT INTO public.tournament_participants (tournament_id, team_id)
SELECT DISTINCT f.tournament_id, f.home_team_id
FROM public.fixtures f
WHERE f.home_team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = f.tournament_id AND tp.team_id = f.home_team_id
  );

INSERT INTO public.tournament_participants (tournament_id, team_id)
SELECT DISTINCT f.tournament_id, f.away_team_id
FROM public.fixtures f
WHERE f.away_team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = f.tournament_id AND tp.team_id = f.away_team_id
  );

-- ─────────────────────────────────────────────────────────────
-- 6) Backfill slot references
-- ─────────────────────────────────────────────────────────────
UPDATE public.standings s
SET participant_id = tp.id
FROM public.tournament_participants tp
WHERE tp.tournament_id = s.tournament_id
  AND tp.team_id = s.team_id
  AND s.participant_id IS NULL;

UPDATE public.group_standings s
SET participant_id = tp.id
FROM public.tournament_participants tp
WHERE tp.tournament_id = s.tournament_id
  AND tp.team_id = s.team_id
  AND s.participant_id IS NULL;

UPDATE public.fixtures f
SET home_participant_id = tp.id
FROM public.tournament_participants tp
WHERE tp.tournament_id = f.tournament_id
  AND tp.team_id = f.home_team_id
  AND f.home_participant_id IS NULL
  AND f.home_team_id IS NOT NULL;

UPDATE public.fixtures f
SET away_participant_id = tp.id
FROM public.tournament_participants tp
WHERE tp.tournament_id = f.tournament_id
  AND tp.team_id = f.away_team_id
  AND f.away_participant_id IS NULL
  AND f.away_team_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 7) Re-key unique constraints to the slot
-- ─────────────────────────────────────────────────────────────
DELETE FROM public.standings a USING public.standings b
WHERE a.id > b.id
  AND a.participant_id IS NOT NULL
  AND a.tournament_id = b.tournament_id
  AND a.participant_id = b.participant_id;

DELETE FROM public.group_standings a USING public.group_standings b
WHERE a.id > b.id
  AND a.participant_id IS NOT NULL
  AND a.tournament_id = b.tournament_id
  AND a.group_name = b.group_name
  AND a.participant_id = b.participant_id;

ALTER TABLE public.standings DROP CONSTRAINT IF EXISTS standings_tournament_id_team_id_key;
ALTER TABLE public.group_standings DROP CONSTRAINT IF EXISTS group_standings_tournament_id_group_name_team_id_key;
ALTER TABLE public.group_standings DROP CONSTRAINT IF EXISTS group_standings_tournament_id_team_id_key;

ALTER TABLE public.standings
  ADD CONSTRAINT standings_tournament_participant_unique UNIQUE (tournament_id, participant_id);
ALTER TABLE public.group_standings
  ADD CONSTRAINT group_standings_tournament_group_participant_unique UNIQUE (tournament_id, group_name, participant_id);

-- ─────────────────────────────────────────────────────────────
-- 8) tournament_applications (season-scoped self-serve applications)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id),
  applicant_id uuid NOT NULL REFERENCES public.profiles(id),
  team_id uuid REFERENCES public.teams(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_applications_season_status_idx
  ON public.tournament_applications (season_id, status);
CREATE INDEX IF NOT EXISTS tournament_applications_applicant_idx
  ON public.tournament_applications (applicant_id, status);

ALTER TABLE public.tournament_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ta_select_own_or_admin" ON public.tournament_applications
  FOR SELECT USING (applicant_id = auth.uid() OR is_admin());
CREATE POLICY "ta_insert_own" ON public.tournament_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "ta_admin_all" ON public.tournament_applications
  FOR ALL USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_applications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_applications TO authenticated;

-- Daily cron to expire stale applications
DO $$
BEGIN
  PERFORM cron.unschedule('expire-tournament-applications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'expire-tournament-applications',
  '0 0 * * *',
  $$
  UPDATE public.tournament_applications
  SET status = 'expired', reviewed_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
  $$
);

-- ─────────────────────────────────────────────────────────────
-- 9) Result-confirmation RLS: slot owners may submit/read too
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rc_select_own_or_admin" ON public.result_confirmations;
DROP POLICY IF EXISTS "rc_insert_own_fixture" ON public.result_confirmations;

CREATE POLICY "rc_select_own_or_admin" ON public.result_confirmations
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = result_confirmations.fixture_id
        AND (
          (f.home_participant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tournament_participants tp
            WHERE tp.id = f.home_participant_id AND tp.user_id = auth.uid()
          ))
          OR (f.away_participant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tournament_participants tp
            WHERE tp.id = f.away_participant_id AND tp.user_id = auth.uid()
          ))
          OR EXISTS (
            SELECT 1 FROM public.teams t
            WHERE (t.id = f.home_team_id OR t.id = f.away_team_id)
              AND t.manager_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "rc_insert_own_fixture" ON public.result_confirmations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id
        AND (
          (f.home_participant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tournament_participants tp
            WHERE tp.id = f.home_participant_id AND tp.user_id = auth.uid()
          ))
          OR (f.away_participant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tournament_participants tp
            WHERE tp.id = f.away_participant_id AND tp.user_id = auth.uid()
          ))
          OR EXISTS (
            SELECT 1 FROM public.teams t
            WHERE (t.id = f.home_team_id OR t.id = f.away_team_id)
              AND t.manager_id = auth.uid()
          )
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 10) check_result_confirmations: match a side via slot owner
--     (team manager kept as fallback)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_result_confirmations()
RETURNS TRIGGER AS $$
DECLARE
  home_conf result_confirmations%ROWTYPE;
  away_conf result_confirmations%ROWTYPE;
  v_fixture fixtures%ROWTYPE;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE id = NEW.fixture_id;

  -- Resolve home-side confirmation via slot owner first, then team manager
  SELECT rc.* INTO home_conf FROM result_confirmations rc
  JOIN fixtures f ON f.id = rc.fixture_id
  WHERE rc.fixture_id = NEW.fixture_id
    AND (
      (f.home_participant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM tournament_participants tp WHERE tp.id = f.home_participant_id AND tp.user_id = rc.submitted_by
      ))
      OR EXISTS (
        SELECT 1 FROM teams t WHERE t.id = f.home_team_id AND t.manager_id = rc.submitted_by
      )
    )
  ORDER BY rc.confirmed_at DESC LIMIT 1;

  SELECT rc.* INTO away_conf FROM result_confirmations rc
  JOIN fixtures f ON f.id = rc.fixture_id
  WHERE rc.fixture_id = NEW.fixture_id
    AND (
      (f.away_participant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM tournament_participants tp WHERE tp.id = f.away_participant_id AND tp.user_id = rc.submitted_by
      ))
      OR EXISTS (
        SELECT 1 FROM teams t WHERE t.id = f.away_team_id AND t.manager_id = rc.submitted_by
      )
    )
  ORDER BY rc.confirmed_at DESC LIMIT 1;

  IF home_conf.id IS NOT NULL AND away_conf.id IS NOT NULL THEN
    IF home_conf.home_score = away_conf.home_score AND home_conf.away_score = away_conf.away_score THEN
      UPDATE fixtures SET status = 'awaiting_confirmation' WHERE id = NEW.fixture_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_confirmation_insert ON result_confirmations;
CREATE TRIGGER on_confirmation_insert
  AFTER INSERT ON result_confirmations
  FOR EACH ROW EXECUTE FUNCTION check_result_confirmations();

-- ─────────────────────────────────────────────────────────────
-- 11) Standings trigger: slot-keyed upserts
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_standings_after_result()
RETURNS TRIGGER AS $$
DECLARE
  v_fixture fixtures%ROWTYPE;
  v_tournament_type text;
  v_group_name text;
  v_home_participant uuid;
  v_away_participant uuid;
  home_gf int;
  home_ga int;
  away_gf int;
  away_ga int;
  home_outcome text;
  away_outcome text;
  home_current standings%ROWTYPE;
  away_current standings%ROWTYPE;
  v_new_form_home text;
  v_new_form_away text;
  home_absent_inc int := 0;
  away_absent_inc int := 0;
  home_gdp_inc int := 0;
  away_gdp_inc int := 0;
  v_reason text;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE fixtures.id = NEW.fixture_id;
  SELECT type INTO v_tournament_type FROM tournaments WHERE tournaments.id = v_fixture.tournament_id;
  v_reason := COALESCE(NEW.override_reason, '');

  -- CONFIRMED PENDING guard: future-dated results captured but deferred
  IF v_fixture.scheduled_date IS NOT NULL
     AND (v_fixture.scheduled_date)::date > CURRENT_DATE THEN
    UPDATE fixtures SET status = 'confirmed_pending' WHERE id = NEW.fixture_id;
    RETURN NEW;
  END IF;

  -- Resolve slot owners (from fixture participant refs, falling back to team)
  v_home_participant := v_fixture.home_participant_id;
  IF v_home_participant IS NULL AND v_fixture.home_team_id IS NOT NULL THEN
    SELECT id INTO v_home_participant FROM tournament_participants
    WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.home_team_id LIMIT 1;
    IF v_home_participant IS NULL THEN
      INSERT INTO tournament_participants (tournament_id, team_id)
      VALUES (v_fixture.tournament_id, v_fixture.home_team_id)
      ON CONFLICT DO NOTHING;
      SELECT id INTO v_home_participant FROM tournament_participants
      WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.home_team_id LIMIT 1;
    END IF;
  END IF;

  v_away_participant := v_fixture.away_participant_id;
  IF v_away_participant IS NULL AND v_fixture.away_team_id IS NOT NULL THEN
    SELECT id INTO v_away_participant FROM tournament_participants
    WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.away_team_id LIMIT 1;
    IF v_away_participant IS NULL THEN
      INSERT INTO tournament_participants (tournament_id, team_id)
      VALUES (v_fixture.tournament_id, v_fixture.away_team_id)
      ON CONFLICT DO NOTHING;
      SELECT id INTO v_away_participant FROM tournament_participants
      WHERE tournament_id = v_fixture.tournament_id AND team_id = v_fixture.away_team_id LIMIT 1;
    END IF;
  END IF;

  -- Outcome / GF / GA / absent-penalty resolution (unchanged logic)
  IF NEW.is_abandoned THEN
    IF NEW.abandoned_type = 'home' THEN
      home_outcome := 'L'; away_outcome := 'W';
      home_gf := NEW.home_score; home_ga := NEW.away_score;
      away_gf := NEW.away_score; away_ga := NEW.home_score;
      home_absent_inc := 1; home_gdp_inc := -3;
    ELSIF NEW.abandoned_type = 'away' THEN
      home_outcome := 'W'; away_outcome := 'L';
      home_gf := NEW.home_score; home_ga := NEW.away_score;
      away_gf := NEW.away_score; away_ga := NEW.home_score;
      away_absent_inc := 1; away_gdp_inc := -3;
    ELSE
      home_outcome := 'L'; away_outcome := 'L';
      home_gf := 0; home_ga := 0; away_gf := 0; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
      away_absent_inc := 1; away_gdp_inc := -3;
    END IF;
  ELSIF v_reason LIKE '%absent%' THEN
    IF v_reason LIKE '%both%' THEN
      home_outcome := 'A'; away_outcome := 'A';
      home_gf := 0; home_ga := 0; away_gf := 0; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
      away_absent_inc := 1; away_gdp_inc := -3;
    ELSIF NEW.home_score = 0 AND NEW.away_score = 3 THEN
      home_outcome := 'A'; away_outcome := 'W';
      home_gf := 0; home_ga := 0; away_gf := 3; away_ga := 0;
      home_absent_inc := 1; home_gdp_inc := -3;
    ELSE
      home_outcome := 'W'; away_outcome := 'A';
      home_gf := 3; home_ga := 0; away_gf := 0; away_ga := 0;
      away_absent_inc := 1; away_gdp_inc := -3;
    END IF;
  ELSE
    home_gf := NEW.home_score; home_ga := NEW.away_score;
    away_gf := NEW.away_score; away_ga := NEW.home_score;
    IF NEW.home_score > NEW.away_score THEN
      home_outcome := 'W'; away_outcome := 'L';
    ELSIF NEW.home_score < NEW.away_score THEN
      home_outcome := 'L'; away_outcome := 'W';
    ELSE
      home_outcome := 'D'; away_outcome := 'D';
    END IF;
  END IF;

  -- Group stage: resolve group from the slot, upsert by participant
  IF v_fixture.round_type = 'group' THEN
    SELECT group_name INTO v_group_name
    FROM tournament_participants WHERE id = v_home_participant;

    INSERT INTO group_standings (
      tournament_id, group_name, participant_id, team_id, played, wins, draws, losses,
      goals_for, goals_against, points, absent, gd_penalty
    ) VALUES (
      v_fixture.tournament_id, COALESCE(v_group_name, 'A'), v_home_participant, v_fixture.home_team_id,
      1,
      CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
      CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
      home_gf, home_ga,
      CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      home_absent_inc, home_gdp_inc
    )
    ON CONFLICT (tournament_id, group_name, participant_id) DO UPDATE SET
      team_id = EXCLUDED.team_id,
      played = group_standings.played + 1,
      wins = group_standings.wins + CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
      draws = group_standings.draws + CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      losses = group_standings.losses + CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
      goals_for = group_standings.goals_for + home_gf,
      goals_against = group_standings.goals_against + home_ga,
      points = group_standings.points + CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
      absent = group_standings.absent + home_absent_inc,
      gd_penalty = group_standings.gd_penalty + home_gdp_inc;

    INSERT INTO group_standings (
      tournament_id, group_name, participant_id, team_id, played, wins, draws, losses,
      goals_for, goals_against, points, absent, gd_penalty
    ) VALUES (
      v_fixture.tournament_id, COALESCE(v_group_name, 'A'), v_away_participant, v_fixture.away_team_id,
      1,
      CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
      CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
      away_gf, away_ga,
      CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      away_absent_inc, away_gdp_inc
    )
    ON CONFLICT (tournament_id, group_name, participant_id) DO UPDATE SET
      team_id = EXCLUDED.team_id,
      played = group_standings.played + 1,
      wins = group_standings.wins + CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
      draws = group_standings.draws + CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      losses = group_standings.losses + CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
      goals_for = group_standings.goals_for + away_gf,
      goals_against = group_standings.goals_against + away_ga,
      points = group_standings.points + CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
      absent = group_standings.absent + away_absent_inc,
      gd_penalty = group_standings.gd_penalty + away_gdp_inc;

    RETURN NEW;
  END IF;

  -- League standings update (slot-keyed)
  SELECT * INTO home_current FROM standings s
  WHERE s.tournament_id = v_fixture.tournament_id AND s.participant_id = v_home_participant;

  SELECT * INTO away_current FROM standings s
  WHERE s.tournament_id = v_fixture.tournament_id AND s.participant_id = v_away_participant;

  v_new_form_home := right(COALESCE(home_current.form, '') || CASE WHEN home_outcome IN ('W','D','L') THEN home_outcome ELSE '' END, 6);
  v_new_form_away := right(COALESCE(away_current.form, '') || CASE WHEN away_outcome IN ('W','D','L') THEN away_outcome ELSE '' END, 6);

  INSERT INTO standings (
    tournament_id, participant_id, team_id, played, wins, draws, losses,
    goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    biggest_win_score, biggest_win_opponent_id, absent, gd_penalty
  ) VALUES (
    v_fixture.tournament_id, v_home_participant, v_fixture.home_team_id,
    1,
    CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
    CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
    home_gf, home_ga,
    CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN home_outcome IN ('W','D','L') THEN home_outcome ELSE '' END,
    CASE WHEN home_outcome IN ('W', 'D') THEN 1 ELSE 0 END,
    CASE WHEN home_ga = 0 AND home_outcome IN ('W','D') THEN 1 ELSE 0 END,
    CASE WHEN home_outcome = 'W' THEN (home_gf::text || '-' || home_ga::text) ELSE NULL END,
    CASE WHEN home_outcome = 'W' THEN v_fixture.away_team_id ELSE NULL END,
    home_absent_inc, home_gdp_inc
  )
  ON CONFLICT (tournament_id, participant_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    played = standings.played + 1,
    wins = standings.wins + CASE WHEN home_outcome = 'W' THEN 1 ELSE 0 END,
    draws = standings.draws + CASE WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    losses = standings.losses + CASE WHEN home_outcome = 'L' THEN 1 ELSE 0 END,
    goals_for = standings.goals_for + home_gf,
    goals_against = standings.goals_against + home_ga,
    points = standings.points + CASE WHEN home_outcome = 'W' THEN 3 WHEN home_outcome = 'D' THEN 1 ELSE 0 END,
    form = CASE WHEN home_outcome IN ('W','D','L') THEN right(COALESCE(standings.form, '') || home_outcome, 6) ELSE standings.form END,
    unbeaten_run = CASE
      WHEN home_outcome IN ('W', 'D') THEN standings.unbeaten_run + 1
      WHEN home_outcome = 'L' THEN 0
      ELSE standings.unbeaten_run
    END,
    clean_sheets = standings.clean_sheets + CASE WHEN home_ga = 0 AND home_outcome IN ('W','D') THEN 1 ELSE 0 END,
    biggest_win_score = CASE
      WHEN home_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (home_gf - home_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN (home_gf::text || '-' || home_ga::text)
      ELSE standings.biggest_win_score
    END,
    biggest_win_opponent_id = CASE
      WHEN home_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (home_gf - home_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN v_fixture.away_team_id
      ELSE standings.biggest_win_opponent_id
    END,
    absent = standings.absent + home_absent_inc,
    gd_penalty = standings.gd_penalty + home_gdp_inc,
    updated_at = now();

  INSERT INTO standings (
    tournament_id, participant_id, team_id, played, wins, draws, losses,
    goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    biggest_win_score, biggest_win_opponent_id, absent, gd_penalty
  ) VALUES (
    v_fixture.tournament_id, v_away_participant, v_fixture.away_team_id,
    1,
    CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
    CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
    away_gf, away_ga,
    CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    CASE WHEN away_outcome IN ('W','D','L') THEN away_outcome ELSE '' END,
    CASE WHEN away_outcome IN ('W', 'D') THEN 1 ELSE 0 END,
    CASE WHEN away_ga = 0 AND away_outcome IN ('W','D') THEN 1 ELSE 0 END,
    CASE WHEN away_outcome = 'W' THEN (away_gf::text || '-' || away_ga::text) ELSE NULL END,
    CASE WHEN away_outcome = 'W' THEN v_fixture.home_team_id ELSE NULL END,
    away_absent_inc, away_gdp_inc
  )
  ON CONFLICT (tournament_id, participant_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    played = standings.played + 1,
    wins = standings.wins + CASE WHEN away_outcome = 'W' THEN 1 ELSE 0 END,
    draws = standings.draws + CASE WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    losses = standings.losses + CASE WHEN away_outcome = 'L' THEN 1 ELSE 0 END,
    goals_for = standings.goals_for + away_gf,
    goals_against = standings.goals_against + away_ga,
    points = standings.points + CASE WHEN away_outcome = 'W' THEN 3 WHEN away_outcome = 'D' THEN 1 ELSE 0 END,
    form = CASE WHEN away_outcome IN ('W','D','L') THEN right(COALESCE(standings.form, '') || away_outcome, 6) ELSE standings.form END,
    unbeaten_run = CASE
      WHEN away_outcome IN ('W', 'D') THEN standings.unbeaten_run + 1
      WHEN away_outcome = 'L' THEN 0
      ELSE standings.unbeaten_run
    END,
    clean_sheets = standings.clean_sheets + CASE WHEN away_ga = 0 AND away_outcome IN ('W','D') THEN 1 ELSE 0 END,
    biggest_win_score = CASE
      WHEN away_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (away_gf - away_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN (away_gf::text || '-' || away_ga::text)
      ELSE standings.biggest_win_score
    END,
    biggest_win_opponent_id = CASE
      WHEN away_outcome = 'W' AND (
        standings.biggest_win_score IS NULL OR
        (away_gf - away_ga) > (
          split_part(standings.biggest_win_score, '-', 1)::int -
          split_part(standings.biggest_win_score, '-', 2)::int
        )
      ) THEN v_fixture.home_team_id
      ELSE standings.biggest_win_opponent_id
    END,
    absent = standings.absent + away_absent_inc,
    gd_penalty = standings.gd_penalty + away_gdp_inc,
    updated_at = now();

  -- abandon_count tracking
  IF NEW.is_abandoned THEN
    IF NEW.abandoned_type IN ('home', 'both') THEN
      UPDATE teams SET abandon_count = abandon_count + 1
      WHERE id = v_fixture.home_team_id;
    END IF;
    IF NEW.abandoned_type IN ('away', 'both') THEN
      UPDATE teams SET abandon_count = abandon_count + 1
      WHERE id = v_fixture.away_team_id;
    END IF;
  END IF;

  UPDATE fixtures SET status = 'confirmed' WHERE id = NEW.fixture_id;

  UPDATE predictions p
  SET points_earned = CASE
    WHEN p.predicted_home_score = NEW.home_score AND p.predicted_away_score = NEW.away_score THEN 3
    WHEN (
      (p.predicted_home_score > p.predicted_away_score AND NEW.home_score > NEW.away_score) OR
      (p.predicted_home_score < p.predicted_away_score AND NEW.home_score < NEW.away_score) OR
      (p.predicted_home_score = p.predicted_away_score AND NEW.home_score = NEW.away_score)
    ) THEN 1
    ELSE 0
  END
  WHERE p.fixture_id = NEW.fixture_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_result_insert ON results;
CREATE TRIGGER on_result_insert
  AFTER INSERT OR UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION update_standings_after_result();

-- ─────────────────────────────────────────────────────────────
-- 12) Atomic RPCs kept slot-keyed (not used by app code directly,
--     but kept consistent with the new unique constraints)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_standings_atomic(
  p_tournament_id uuid,
  p_participant_id uuid,
  p_team_id uuid,
  p_played_inc int,
  p_wins_inc int,
  p_draws_inc int,
  p_losses_inc int,
  p_gf_inc int,
  p_ga_inc int,
  p_points_inc int,
  p_form_char text,
  p_unbeaten_run_reset boolean,
  p_clean_sheet_inc int,
  p_absent_inc int DEFAULT 0,
  p_gd_penalty_inc int DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO standings (
    tournament_id, participant_id, team_id, played, wins, draws, losses, goals_for, goals_against, points, form, unbeaten_run, clean_sheets,
    absent, gd_penalty
  ) VALUES (
    p_tournament_id, p_participant_id, p_team_id, p_played_inc, p_wins_inc, p_draws_inc, p_losses_inc, p_gf_inc, p_ga_inc, p_points_inc, p_form_char,
    CASE WHEN p_unbeaten_run_reset THEN 0 ELSE p_wins_inc + p_draws_inc END, p_clean_sheet_inc,
    p_absent_inc, p_gd_penalty_inc
  )
  ON CONFLICT (tournament_id, participant_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    played = standings.played + p_played_inc,
    wins = standings.wins + p_wins_inc,
    draws = standings.draws + p_draws_inc,
    losses = standings.losses + p_losses_inc,
    goals_for = standings.goals_for + p_gf_inc,
    goals_against = standings.goals_against + p_ga_inc,
    points = standings.points + p_points_inc,
    form = right(standings.form || p_form_char, 5),
    unbeaten_run = CASE WHEN p_unbeaten_run_reset THEN 0 ELSE standings.unbeaten_run + p_played_inc END,
    clean_sheets = standings.clean_sheets + p_clean_sheet_inc,
    absent = standings.absent + p_absent_inc,
    gd_penalty = standings.gd_penalty + p_gd_penalty_inc,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_group_standings_atomic(
  p_tournament_id uuid,
  p_group_name text,
  p_participant_id uuid,
  p_team_id uuid,
  p_played_inc int,
  p_wins_inc int,
  p_draws_inc int,
  p_losses_inc int,
  p_gf_inc int,
  p_ga_inc int,
  p_points_inc int,
  p_absent_inc int DEFAULT 0,
  p_gd_penalty_inc int DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO group_standings (
    tournament_id, group_name, participant_id, team_id, played, wins, draws, losses, goals_for, goals_against, points,
    absent, gd_penalty
  ) VALUES (
    p_tournament_id, p_group_name, p_participant_id, p_team_id, p_played_inc, p_wins_inc, p_draws_inc, p_losses_inc, p_gf_inc, p_ga_inc, p_points_inc,
    p_absent_inc, p_gd_penalty_inc
  )
  ON CONFLICT (tournament_id, group_name, participant_id) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    played = group_standings.played + p_played_inc,
    wins = group_standings.wins + p_wins_inc,
    draws = group_standings.draws + p_draws_inc,
    losses = group_standings.losses + p_losses_inc,
    goals_for = group_standings.goals_for + p_gf_inc,
    goals_against = group_standings.goals_against + p_ga_inc,
    points = group_standings.points + p_points_inc,
    absent = group_standings.absent + p_absent_inc,
    gd_penalty = group_standings.gd_penalty + p_gd_penalty_inc,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;