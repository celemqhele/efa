import eFootballTeams from './efootball-2027-teams.json'

export function isAllowedTeam(leagueFolder: string, teamSlug: string): boolean {
  const allowedLeagues = eFootballTeams.leagues as Record<string, string[]>
  return allowedLeagues[leagueFolder]?.includes(teamSlug) ?? false
}

export function filterTeams<T extends { logo_league_folder: string; logo_team_slug: string }>(teams: T[]): T[] {
  return teams.filter(team => isAllowedTeam(team.logo_league_folder, team.logo_team_slug))
}
