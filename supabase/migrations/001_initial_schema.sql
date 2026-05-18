-- EFA Platform — Initial Schema
-- Run in Supabase SQL Editor

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  role text default 'user' check (role in ('user', 'admin')),
  avatar_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_league_folder text not null,
  logo_team_slug text not null,
  manager_id uuid references profiles(id) unique,
  abandon_count int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- TEAM CHANGE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS team_change_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_user_id uuid references profiles(id),
  current_team_id uuid references teams(id),
  requested_team_id uuid references teams(id),
  status text default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- SEASONS
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_league text not null,
  status text default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- ============================================================
-- TOURNAMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id),
  name text not null,
  type text not null check (type in ('league', 'ucl', 'europa', 'super_cup')),
  status text default 'upcoming',
  settings jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- TOURNAMENT PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team_id uuid references teams(id),
  group_name text,
  seed_pot int
);

-- ============================================================
-- SEASON BREAKS
-- ============================================================
CREATE TABLE IF NOT EXISTS season_breaks (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  break_start date not null,
  break_end date not null,
  reason text
);

-- ============================================================
-- FIXTURES
-- ============================================================
CREATE TABLE IF NOT EXISTS fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  matchday int not null,
  round_type text default 'league' check (round_type in ('league', 'group', 'qf', 'sf', 'final', 'super_cup')),
  leg int default 1,
  scheduled_date date,
  status text default 'scheduled',
  is_postponed boolean default false,
  postponed_from date,
  deadline timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- RESULT CONFIRMATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS result_confirmations (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  submitted_by uuid references profiles(id),
  home_score int not null,
  away_score int not null,
  confirmed_at timestamptz default now()
);

-- ============================================================
-- RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS results (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id) unique,
  home_score int not null,
  away_score int not null,
  is_abandoned boolean default false,
  abandoned_type text check (abandoned_type in ('home', 'away', 'both')),
  finalised_by uuid references profiles(id),
  screenshot_url text,
  override_reason text,
  created_at timestamptz default now()
);

-- ============================================================
-- MATCH STATS
-- ============================================================
CREATE TABLE IF NOT EXISTS match_stats (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references results(id) unique,
  home_possession int,
  away_possession int,
  home_shots int,
  away_shots int,
  home_shots_on_target int,
  away_shots_on_target int,
  home_fouls int,
  away_fouls int,
  home_offsides int,
  away_offsides int,
  home_corners int,
  away_corners int,
  home_free_kicks int,
  away_free_kicks int,
  home_passes int,
  away_passes int,
  home_successful_passes int,
  away_successful_passes int,
  home_crosses int,
  away_crosses int,
  home_interceptions int,
  away_interceptions int,
  home_tackles int,
  away_tackles int,
  home_saves int,
  away_saves int
);

-- ============================================================
-- STANDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  team_id uuid references teams(id),
  played int default 0,
  wins int default 0,
  draws int default 0,
  losses int default 0,
  goals_for int default 0,
  goals_against int default 0,
  goal_difference int generated always as (goals_for - goals_against) stored,
  points int default 0,
  form text default '',
  unbeaten_run int default 0,
  biggest_win_score text,
  biggest_win_opponent_id uuid references teams(id),
  clean_sheets int default 0,
  updated_at timestamptz default now(),
  unique(tournament_id, team_id)
);

-- ============================================================
-- GROUP STANDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS group_standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  group_name text not null,
  team_id uuid references teams(id),
  played int default 0,
  wins int default 0,
  draws int default 0,
  losses int default 0,
  goals_for int default 0,
  goals_against int default 0,
  goal_difference int generated always as (goals_for - goals_against) stored,
  points int default 0,
  unique(tournament_id, group_name, team_id)
);

-- ============================================================
-- KNOCKOUT ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS knockout_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  round_name text not null,
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  home_agg int default 0,
  away_agg int default 0,
  winner_id uuid references teams(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TEAM NAME MAPPINGS (OCR)
-- ============================================================
CREATE TABLE IF NOT EXISTS team_name_mappings (
  id uuid primary key default gen_random_uuid(),
  ocr_name text unique not null,
  team_id uuid references teams(id)
);

-- ============================================================
-- WAITING REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS waiting_reports (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  reported_by_team_id uuid references teams(id),
  reported_at timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  user_id uuid references profiles(id),
  parent_id uuid references comments(id),
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS reactions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  user_id uuid references profiles(id),
  emoji text not null,
  unique(fixture_id, user_id, emoji)
);

-- ============================================================
-- PREDICTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  user_id uuid references profiles(id),
  predicted_home_score int,
  predicted_away_score int,
  points_earned int default 0,
  unique(fixture_id, user_id)
);

-- ============================================================
-- TROPHIES
-- ============================================================
CREATE TABLE IF NOT EXISTS trophies (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id),
  tournament_id uuid references tournaments(id),
  season_id uuid references seasons(id),
  trophy_type text check (trophy_type in ('league', 'ucl', 'europa', 'super_cup')),
  awarded_at timestamptz default now()
);

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);
