-- EFA Platform — Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knockout_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_name_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (is_admin());

-- ============================================================
-- TEAMS — public read, admin write
-- ============================================================
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_admin_all" ON teams FOR ALL USING (is_admin());

-- ============================================================
-- TEAM CHANGE REQUESTS
-- ============================================================
CREATE POLICY "tcr_select_own_or_admin" ON team_change_requests
  FOR SELECT USING (requesting_user_id = auth.uid() OR is_admin());
CREATE POLICY "tcr_insert_own" ON team_change_requests
  FOR INSERT WITH CHECK (requesting_user_id = auth.uid());
CREATE POLICY "tcr_admin_update" ON team_change_requests
  FOR UPDATE USING (is_admin());

-- ============================================================
-- SEASONS & TOURNAMENTS — public read
-- ============================================================
CREATE POLICY "seasons_select_all" ON seasons FOR SELECT USING (true);
CREATE POLICY "seasons_admin_all" ON seasons FOR ALL USING (is_admin());

CREATE POLICY "tournaments_select_all" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_admin_all" ON tournaments FOR ALL USING (is_admin());

CREATE POLICY "tp_select_all" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "tp_admin_all" ON tournament_participants FOR ALL USING (is_admin());

CREATE POLICY "breaks_select_all" ON season_breaks FOR SELECT USING (true);
CREATE POLICY "breaks_admin_all" ON season_breaks FOR ALL USING (is_admin());

-- ============================================================
-- FIXTURES — public read
-- ============================================================
CREATE POLICY "fixtures_select_all" ON fixtures FOR SELECT USING (true);
CREATE POLICY "fixtures_admin_all" ON fixtures FOR ALL USING (is_admin());

-- ============================================================
-- RESULT CONFIRMATIONS — own team or admin
-- ============================================================
CREATE POLICY "rc_select_own_or_admin" ON result_confirmations
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM fixtures f
      JOIN teams t ON (t.id = f.home_team_id OR t.id = f.away_team_id)
      WHERE f.id = fixture_id AND t.manager_id = auth.uid()
    )
  );
CREATE POLICY "rc_insert_own_fixture" ON result_confirmations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM fixtures f
      JOIN teams t ON (t.id = f.home_team_id OR t.id = f.away_team_id)
      WHERE f.id = fixture_id AND t.manager_id = auth.uid()
    )
  );
CREATE POLICY "rc_admin_all" ON result_confirmations FOR ALL USING (is_admin());

-- ============================================================
-- RESULTS — public read, admin write
-- ============================================================
CREATE POLICY "results_select_all" ON results FOR SELECT USING (true);
CREATE POLICY "results_admin_all" ON results FOR ALL USING (is_admin());

-- ============================================================
-- MATCH STATS — public read, admin write
-- ============================================================
CREATE POLICY "ms_select_all" ON match_stats FOR SELECT USING (true);
CREATE POLICY "ms_admin_all" ON match_stats FOR ALL USING (is_admin());

-- ============================================================
-- STANDINGS — public read, admin/trigger write
-- ============================================================
CREATE POLICY "standings_select_all" ON standings FOR SELECT USING (true);
CREATE POLICY "standings_admin_all" ON standings FOR ALL USING (is_admin());

CREATE POLICY "gs_select_all" ON group_standings FOR SELECT USING (true);
CREATE POLICY "gs_admin_all" ON group_standings FOR ALL USING (is_admin());

CREATE POLICY "kr_select_all" ON knockout_rounds FOR SELECT USING (true);
CREATE POLICY "kr_admin_all" ON knockout_rounds FOR ALL USING (is_admin());

-- ============================================================
-- TEAM NAME MAPPINGS — admin only
-- ============================================================
CREATE POLICY "tnm_select_admin" ON team_name_mappings FOR SELECT USING (is_admin());
CREATE POLICY "tnm_admin_all" ON team_name_mappings FOR ALL USING (is_admin());

-- ============================================================
-- WAITING REPORTS — own team
-- ============================================================
CREATE POLICY "wr_select_own_or_admin" ON waiting_reports
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM teams WHERE id = reported_by_team_id AND manager_id = auth.uid()
    )
  );
CREATE POLICY "wr_insert_own" ON waiting_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE id = reported_by_team_id AND manager_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS — own user
-- ============================================================
CREATE POLICY "notif_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_admin_all" ON notifications FOR ALL USING (is_admin());
CREATE POLICY "notif_service_insert" ON notifications FOR INSERT WITH CHECK (true);

-- ============================================================
-- COMMENTS & REACTIONS — logged-in users
-- ============================================================
CREATE POLICY "comments_select_all" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "reactions_select_all" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_auth" ON reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "reactions_delete_own" ON reactions FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- PREDICTIONS — logged-in users
-- ============================================================
CREATE POLICY "predictions_select_all" ON predictions FOR SELECT USING (true);
CREATE POLICY "predictions_insert_auth" ON predictions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "predictions_update_own" ON predictions
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- TROPHIES — public read
-- ============================================================
CREATE POLICY "trophies_select_all" ON trophies FOR SELECT USING (true);
CREATE POLICY "trophies_admin_all" ON trophies FOR ALL USING (is_admin());

-- ============================================================
-- PUSH SUBSCRIPTIONS — own user
-- ============================================================
CREATE POLICY "ps_select_own" ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ps_insert_own" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ps_delete_own" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "ps_admin_all" ON push_subscriptions FOR ALL USING (is_admin());

-- ============================================================
-- AUDIT LOG — admin only
-- ============================================================
CREATE POLICY "audit_admin_all" ON audit_log FOR ALL USING (is_admin());
CREATE POLICY "audit_service_insert" ON audit_log FOR INSERT WITH CHECK (true);
