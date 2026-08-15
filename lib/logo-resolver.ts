const SIZE_MAP = {
  standings_row: '64x64',
  group_table: '64x64',
  fixture_card: '128x128',
  profile_avatar: '128x128',
  news_thumb: '256x256',
  match_detail_hero: '512x512',
  broadcast_download: '700x700',
} as const

export type LogoContext = keyof typeof SIZE_MAP

export function getTeamLogo(
  leagueFolder: string,
  teamSlug: string,
  context: LogoContext
): string {
  return `/logos/${leagueFolder}/${SIZE_MAP[context]}/${teamSlug}.png`
}

export function getLeagueFolders(): string[] {
  // Returns known league folders — populated from public/logos directory names
  return [
    'argentina-primera-division-2025-2026.football-logos.cc',
    'brazil-serie-a-2025-2026.football-logos.cc',
    'brazil-serie-b-2025-2026.football-logos.cc',
    'england-efl-championship-2025-2026.football-logos.cc',
    'english-premier-league-2025-2026.football-logos.cc',
    'fifa-world-cup-2026.football-logos.cc',
    'france-ligue-1-2025-2026.football-logos.cc',
    'france-ligue-2-2025-2026.football-logos.cc',
    'germany-2-bundesliga-2025-2026.football-logos.cc',
    'germany-bundesliga-2025-2026.football-logos.cc',
    'italy-serie-a-2025-2026.football-logos.cc',
    'italy-serie-b-2025-2026.football-logos.cc',
    'netherlands-eredivisie-2025-2026.football-logos.cc',
    'portugal-primeira-liga-2025-2026.football-logos.cc',
    'romania-liga-1-2025-2026.football-logos.cc',
    'saudi-arabia-pro-league-2025-2026.football-logos.cc',
    'scotland-premiership-2025-2026.football-logos.cc',
    'spain-la-liga-2-2025-2026.football-logos.cc',
    'spain-la-liga-2025-2026.football-logos.cc',
    'ucl-champions-league-2025-2026.football-logos.cc',
    'uefa-conference-league-2025-2026.football-logos.cc',
    'uefa-europa-league-2025-2026.football-logos.cc',
    // New 2026-27 folders
    'moroccan-league-2026-2027.football-logos.cc',
    'thai-league-2026-2027.football-logos.cc',
    'malaysia-super-league-2026-2027.football-logos.cc',
    'korean-league-2026-2027.football-logos.cc',
    'afc-champions-league-elite-2026-2027.football-logos.cc',
    'afc-champions-league-two-2026-2027.football-logos.cc',
  ]
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const SLUG_OVERRIDES: Record<string, string> = {
  'dutch-national-team': 'Netherlands',
  'portugal-national-team': 'Portugal',
  'france-national-team': 'France',
  'germany-national-team': 'Germany',
  'italy-national-team': 'Italy',
  'spain-national-team': 'Spain',
  'argentina-national-team': 'Argentina',
  'england-national-team': 'England',
  'brazil-national-team': 'Brazil',
}

export function slugToDisplayName(slug: string, fallback?: string): string {
  return SLUG_OVERRIDES[slug] ?? fallback ?? slugToName(slug)
}

export function getLeagueDisplayName(folder: string): string {
  const map: Record<string, string> = {
    'argentina-primera-division-2025-2026.football-logos.cc': 'Argentina Primera División',
    'brazil-serie-a-2025-2026.football-logos.cc': 'Brazil Série A',
    'brazil-serie-b-2025-2026.football-logos.cc': 'Brazil Série B',
    'england-efl-championship-2025-2026.football-logos.cc': 'EFL Championship',
    'english-premier-league-2025-2026.football-logos.cc': 'English Premier League',
    'fifa-world-cup-2026.football-logos.cc': 'FIFA World Cup 2026',
    'france-ligue-1-2025-2026.football-logos.cc': 'France Ligue 1',
    'france-ligue-2-2025-2026.football-logos.cc': 'France Ligue 2',
    'germany-2-bundesliga-2025-2026.football-logos.cc': '2. Bundesliga',
    'germany-bundesliga-2025-2026.football-logos.cc': 'Bundesliga',
    'italy-serie-a-2025-2026.football-logos.cc': 'Italy Serie A',
    'italy-serie-b-2025-2026.football-logos.cc': 'Italy Serie B',
    'netherlands-eredivisie-2025-2026.football-logos.cc': 'Eredivisie',
    'portugal-primeira-liga-2025-2026.football-logos.cc': 'Primeira Liga',
    'romania-liga-1-2025-2026.football-logos.cc': 'Liga 1 Romania',
    'saudi-arabia-pro-league-2025-2026.football-logos.cc': 'Saudi Pro League',
    'scotland-premiership-2025-2026.football-logos.cc': 'Scottish Premiership',
    'spain-la-liga-2-2025-2026.football-logos.cc': 'La Liga 2',
    'spain-la-liga-2025-2026.football-logos.cc': 'La Liga',
    'ucl-champions-league-2025-2026.football-logos.cc': 'UEFA Champions League',
    'uefa-conference-league-2025-2026.football-logos.cc': 'UEFA Conference League',
    'uefa-europa-league-2025-2026.football-logos.cc': 'UEFA Europa League',
  }
  return map[folder] ?? folder
}
