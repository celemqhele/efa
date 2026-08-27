import registryData from './registry-data.json'

// ─── Metadata for every logo folder ──────────────────────────────────────────

export interface LeagueMeta {
  region: string
  country: string
  league: string
  isNational?: boolean
}

export const LEAGUE_META: Record<string, LeagueMeta> = {
  // International
  'fifa-world-cup-2026.football-logos.cc':
    { region: 'International', country: 'World', league: 'FIFA World Cup 2026', isNational: true },

  // Europe — England
  'english-premier-league-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'England', league: 'Premier League' },
  'england-efl-championship-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'England', league: 'Championship' },

  // Europe — Spain
  'spain-la-liga-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Spain', league: 'La Liga' },
  'spain-la-liga-2-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Spain', league: 'La Liga 2' },

  // Europe — Germany
  'germany-bundesliga-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Germany', league: 'Bundesliga' },
  'germany-2-bundesliga-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Germany', league: '2. Bundesliga' },

  // Europe — Italy
  'italy-serie-a-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Italy', league: 'Serie A' },
  'italy-serie-b-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Italy', league: 'Serie B' },

  // Europe — France
  'france-ligue-1-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'France', league: 'Ligue 1' },
  'france-ligue-2-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'France', league: 'Ligue 2' },

  // Europe — Netherlands
  'netherlands-eredivisie-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Netherlands', league: 'Eredivisie' },

  // Europe — Portugal
  'portugal-primeira-liga-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Portugal', league: 'Primeira Liga' },

  // Europe — Scotland
  'scotland-premiership-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Scotland', league: 'Premiership' },

  // Europe — Romania
  'romania-liga-1-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'Romania', league: 'Liga 1' },

  // Europe — UEFA Competitions
  'ucl-champions-league-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'UEFA', league: 'Champions League' },
  'uefa-europa-league-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'UEFA', league: 'Europa League' },
  'uefa-conference-league-2025-2026.football-logos.cc':
    { region: 'Europe', country: 'UEFA', league: 'Conference League' },

  // South America
  'argentina-primera-division-2025-2026.football-logos.cc':
    { region: 'South America', country: 'Argentina', league: 'Primera División' },
  'brazil-serie-a-2025-2026.football-logos.cc':
    { region: 'South America', country: 'Brazil', league: 'Série A' },
  'brazil-serie-b-2025-2026.football-logos.cc':
    { region: 'South America', country: 'Brazil', league: 'Série B' },

  // Middle East
  'saudi-arabia-pro-league-2025-2026.football-logos.cc':
    { region: 'Middle East', country: 'Saudi Arabia', league: 'Saudi Pro League' },
}

// ─── Slug → display name ──────────────────────────────────────────────────────

const NATIONAL_NAMES: Record<string, string> = {
  'dutch-national-team': 'Netherlands',
  'portuguese-football-federation': 'Portugal',
  'cote-d-ivoire-national-team': "Côte d'Ivoire",
  'congo-dr-national-team': 'DR Congo',
  'usa-national-team': 'USA',
  'south-korea-national-team': 'South Korea',
  'new-zealand-national-team': 'New Zealand',
  'cabo-verde-national-team': 'Cabo Verde',
  'bosnia-and-herzegovina-national-team': 'Bosnia & Herzegovina',
  'saudi-arabia-national-team': 'Saudi Arabia',
  'south-africa-national-team': 'South Africa',
}

const CLUB_NAMES: Record<string, string> = {
  // Germany
  'bayern-munchen': 'Bayern München',
  'borussia-monchengladbach': 'Borussia Mönchengladbach',
  'koln': 'FC Köln',
  'mainz-05': 'Mainz 05',
  'fc-heidenheim': 'FC Heidenheim',
  'st-pauli': 'FC St. Pauli',
  'vfb-stuttgart': 'VfB Stuttgart',
  'wolfsburg': 'VfL Wolfsburg',
  'hamburger-sv': 'Hamburger SV',
  'spvgg-greuther-furth': 'SpVgg Greuther Fürth',
  'fc-nurnberg': '1. FC Nürnberg',
  '1-fc-magdeburg': '1. FC Magdeburg',
  'hannover-96': 'Hannover 96',
  'fortuna-dusseldorf': 'Fortuna Düsseldorf',
  'preussen-munster': 'Preußen Münster',
  'dynamo-dresden': 'Dynamo Dresden',
  'fc-kaiserslautern': '1. FC Kaiserslautern',
  'schalke-04': 'FC Schalke 04',
  'eintracht-braunschweig': 'Eintracht Braunschweig',
  // Italy
  'inter': 'Internazionale Milan',
  'milan': 'AC Milan',
  'como-1907': 'Como 1907',
  'verona': 'Hellas Verona',
  'suditrol': 'Südtirol',
  'juve-stabia': 'Juve Stabia',
  'mantova-1911': 'Mantova 1911',
  'us-avellino-1912': 'US Avellino 1912',
  'virtus-entella': 'Virtus Entella',
  // France
  'as-monaco': 'AS Monaco',
  'paris-fc': 'Paris FC',
  'le-havre-ac': 'Le Havre AC',
  'rc-lens': 'RC Lens',
  'rc-strasbourg-alsace': 'RC Strasbourg',
  'as-saint-etienne': 'AS Saint-Étienne',
  'stade-de-reims': 'Stade de Reims',
  'stade-lavallois': 'Stade Lavallois',
  'grenoble-foot-38': 'Grenoble Foot 38',
  // Spain
  'celta': 'RC Celta',
  'athletic-club': 'Athletic Club',
  'atletico-madrid': 'Atlético Madrid',
  'real-betis': 'Real Betis',
  'real-madrid': 'Real Madrid',
  'real-sociedad': 'Real Sociedad',
  'rayo-vallecano': 'Rayo Vallecano',
  'leganes': 'Leganés',
  'almeria': 'Almería',
  'cadiz': 'Cádiz',
  'malaga': 'Málaga',
  'mirandes': 'Mirandés',
  'zaragoza': 'Real Zaragoza',
  'deportivo-la-coruna': 'Deportivo La Coruña',
  'cultural-leonesa': 'Cultural Leonesa',
  'sporting-gijon': 'Sporting Gijón',
  'racing': 'Racing de Santander',
  'deportivo': 'Deportivo La Coruña',
  // Netherlands
  'az-alkmaar': 'AZ Alkmaar',
  'nac-breda': 'NAC Breda',
  'nec-nijmegen': 'NEC Nijmegen',
  'pec-zwolle': 'PEC Zwolle',
  'sc-heerenveen': 'SC Heerenveen',
  'go-ahead-eagles': 'Go Ahead Eagles',
  // Portugal
  'avs-futebol-sad': 'AVS Futebol SAD',
  'casa-pia-ac': 'Casa Pia AC',
  'vitoria-de-guimaraes': 'Vitória de Guimarães',
  'nacional-da-madeira': 'Nacional',
  'famalicao': 'FC Famalicão',
  'estrela-da-amadora': 'Estrela da Amadora',
  'estoril': 'Estoril Praia',
  // Romania
  'cfr-cluj': 'CFR Cluj',
  'fcsb': 'FCSB',
  'u-cluj': 'U Cluj',
  'u-craiova': 'U Craiova',
  'farul-constanta': 'Farul Constanța',
  'rapid-bucuresti': 'Rapid București',
  'dinamo-bucuresti': 'Dinamo București',
  'petrolul-ploiesti': 'Petrolul Ploiești',
  'uta': 'UTA Arad',
  'arges-pitesti': 'Argeș Pitești',
  // Scotland
  'hearts': 'Heart of Midlothian',
  'st-mirren': 'St. Mirren',
  // Argentina
  'san-lorenzo-de-almagro': 'San Lorenzo',
  'argeninos-juniors': 'Argentinos Juniors',
  'atletico-tucuman': 'Atlético Tucumán',
  'ca-huracan': 'Huracán',
  'central-cordoba': 'Central Córdoba',
  'club-atletico-platanense': 'Platense',
  'defensa-y-justicia': 'Defensa y Justicia',
  'deportivo-riestra': 'Deportivo Riestra',
  'estudiantes-de-la-plata': 'Estudiantes de La Plata',
  'estudiantes-de-rio-cuarto': 'Estudiantes Río Cuarto',
  'gimnasia-lp': 'Gimnasia LP',
  'gimnasia-y-esgrima': 'Gimnasia y Esgrima',
  'independiente-rivadavia': 'Independiente Rivadavia',
  'instituto-cordoba': 'Instituto Córdoba',
  'newells-old-boys': "Newell's Old Boys",
  'rosario-central': 'Rosario Central',
  'velez-sarsfield': 'Vélez Sarsfield',
  // Brazil
  'athletico-paranaense': 'Athletico Paranaense',
  'atletico-mineiro': 'Atlético Mineiro',
  'atletico-goianiense': 'Atlético Goianiense',
  'rb-bragantino': 'RB Bragantino',
  'vasco-da-gama': 'Vasco da Gama',
  'america-mineiro': 'América Mineiro',
  'botafogo-sp': 'Botafogo SP',
  'operario-ferroviario': 'Operário Ferroviário',
  'ponte-preta': 'Ponte Preta',
  'sao-bernardo': 'São Bernardo',
  'sao-paulo': 'São Paulo',
  'sport-recife': 'Sport Recife',
  // European competitions
  'bodo-glimt': 'Bodø/Glimt',
  'slavia-praha': 'Slavia Praha',
  'sparta-praha': 'Sparta Praha',
  'union-saint-gilloise': 'Union Saint-Gilloise',
  'aek-athens': 'AEK Athens',
  'aek-larnaca': 'AEK Larnaca',
  'lech-poznan': 'Lech Poznań',
  'legia-warszawa': 'Legia Warszawa',
  's-bratislava': 'ŠK Slovan Bratislava',
  'jagiellonia': 'Jagiellonia Białystok',
  'hamrun-spartans': 'Ħamrun Spartans',
  'breidablik': 'Breiðablik',
  'crvena-zvezda': 'Crvena zvezda',
  'fenerbahce': 'Fenerbahçe',
  'ferencvaros': 'Ferencváros',
  'maccabi-tel-aviv': 'Maccabi Tel Aviv',
  'malmo': 'Malmö FF',
  'panathinaikos': 'Panathinaikos',
  'paok': 'PAOK',
  'viktoria-plzen': 'Viktoria Plzeň',
  'salzburg': 'Red Bull Salzburg',
  'shakhtar': 'Shakhtar Donetsk',
  'ludogorets': 'Ludogorets Razgrad',
  'pafos': 'Pafos FC',
}

const UPPERCASE_WORDS = new Set(['fc', 'ac', 'as', 'rb', 'sc', 'cf', 'cd', 'vfl', 'rc', 'nac', 'nec', 'pec', 'psv', 'fk', 'bk', 'aek', 'usa', 'fcsb', 'uta', 'paok'])

function slugToName(slug: string, isNational = false): string {
  if (isNational) {
    if (NATIONAL_NAMES[slug]) return NATIONAL_NAMES[slug]
    return slug
      .replace('-national-team', '')
      .replace('-football-federation', '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  if (CLUB_NAMES[slug]) return CLUB_NAMES[slug]
  return slug
    .split('-')
    .map((w) => {
      if (UPPERCASE_WORDS.has(w.toLowerCase())) return w.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

// ─── Server-side registry builder ────────────────────────────────────────────

export interface TeamEntry {
  slug: string
  name: string
}

export interface RegistryEntry extends LeagueMeta {
  folder: string
  teams: TeamEntry[]
}

export async function buildRegistry(): Promise<RegistryEntry[]> {
  const folderTeams = (registryData as { folder_teams: Record<string, string[]> }).folder_teams
  const entries: RegistryEntry[] = []

  for (const [folder, meta] of Object.entries(LEAGUE_META)) {
    const slugs = folderTeams[folder] ?? []
    const teams = slugs
      .map((slug) => ({ slug, name: slugToName(slug, meta.isNational) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (teams.length > 0) {
      entries.push({ folder, ...meta, teams })
    }
  }

  return entries
}
