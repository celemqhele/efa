-- List all teams in the database
SELECT id, name, logo_league_folder, logo_team_slug, manager_id, created_at
FROM teams
ORDER BY name;