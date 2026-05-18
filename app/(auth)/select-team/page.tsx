'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getLeagueFolders, getLeagueDisplayName, getTeamLogo } from '@/lib/logo-resolver'
import type { Team } from '@/lib/supabase/types'

// Pre-built team registry matching the logos in /public/logos
const TEAM_REGISTRY: Record<string, Array<{ slug: string; name: string }>> = {
  'english-premier-league-2025-2026.football-logos.cc': [
    { slug: 'arsenal', name: 'Arsenal' },
    { slug: 'aston-villa', name: 'Aston Villa' },
    { slug: 'bournemouth', name: 'Bournemouth' },
    { slug: 'brentford', name: 'Brentford' },
    { slug: 'brighton', name: 'Brighton' },
    { slug: 'burnley', name: 'Burnley' },
    { slug: 'chelsea', name: 'Chelsea' },
    { slug: 'crystal-palace', name: 'Crystal Palace' },
    { slug: 'everton', name: 'Everton' },
    { slug: 'fulham', name: 'Fulham' },
    { slug: 'leeds-united', name: 'Leeds United' },
    { slug: 'liverpool', name: 'Liverpool' },
    { slug: 'manchester-city', name: 'Manchester City' },
    { slug: 'manchester-united', name: 'Manchester United' },
    { slug: 'newcastle', name: 'Newcastle United' },
    { slug: 'nottingham-forest', name: 'Nottingham Forest' },
    { slug: 'sunderland', name: 'Sunderland' },
    { slug: 'tottenham', name: 'Tottenham Hotspur' },
    { slug: 'west-ham', name: 'West Ham United' },
    { slug: 'wolves', name: 'Wolverhampton Wanderers' },
  ],
  'spain-la-liga-2025-2026.football-logos.cc': [
    { slug: 'atletico-madrid', name: 'Atlético Madrid' },
    { slug: 'barcelona', name: 'Barcelona' },
    { slug: 'real-madrid', name: 'Real Madrid' },
    { slug: 'sevilla', name: 'Sevilla' },
    { slug: 'valencia', name: 'Valencia' },
    { slug: 'villarreal', name: 'Villarreal' },
    { slug: 'real-sociedad', name: 'Real Sociedad' },
    { slug: 'athletic-bilbao', name: 'Athletic Bilbao' },
    { slug: 'betis', name: 'Real Betis' },
    { slug: 'osasuna', name: 'Osasuna' },
    { slug: 'getafe', name: 'Getafe' },
    { slug: 'rayo-vallecano', name: 'Rayo Vallecano' },
    { slug: 'girona', name: 'Girona' },
    { slug: 'celta-vigo', name: 'Celta Vigo' },
    { slug: 'mallorca', name: 'Mallorca' },
    { slug: 'alaves', name: 'Alavés' },
    { slug: 'las-palmas', name: 'Las Palmas' },
    { slug: 'leganes', name: 'Leganés' },
    { slug: 'espanyol', name: 'Espanyol' },
    { slug: 'valladolid', name: 'Valladolid' },
  ],
  'germany-bundesliga-2025-2026.football-logos.cc': [
    { slug: 'bayer-leverkusen', name: 'Bayer Leverkusen' },
    { slug: 'borussia-dortmund', name: 'Borussia Dortmund' },
    { slug: 'rb-leipzig', name: 'RB Leipzig' },
    { slug: 'bayern-munich', name: 'Bayern München' },
    { slug: 'borussia-mgladbach', name: 'Borussia Mönchengladbach' },
    { slug: 'union-berlin', name: 'Union Berlin' },
    { slug: 'freiburg', name: 'Freiburg' },
    { slug: 'cologne', name: 'Cologne' },
    { slug: 'mainz', name: 'Mainz' },
    { slug: 'hoffenheim', name: 'Hoffenheim' },
    { slug: 'werder-bremen', name: 'Werder Bremen' },
    { slug: 'eintracht-frankfurt', name: 'Eintracht Frankfurt' },
    { slug: 'wolfsburg', name: 'Wolfsburg' },
    { slug: 'augsburg', name: 'Augsburg' },
    { slug: 'bochum', name: 'Bochum' },
    { slug: 'heidenheim', name: 'Heidenheim' },
    { slug: 'fc-st-pauli', name: 'FC St. Pauli' },
    { slug: 'holstenkiel', name: 'Holstein Kiel' },
  ],
  'italy-serie-a-2025-2026.football-logos.cc': [
    { slug: 'ac-milan', name: 'AC Milan' },
    { slug: 'inter-milan', name: 'Inter Milan' },
    { slug: 'juventus', name: 'Juventus' },
    { slug: 'napoli', name: 'Napoli' },
    { slug: 'roma', name: 'Roma' },
    { slug: 'lazio', name: 'Lazio' },
    { slug: 'atalanta', name: 'Atalanta' },
    { slug: 'fiorentina', name: 'Fiorentina' },
    { slug: 'torino', name: 'Torino' },
    { slug: 'bologna', name: 'Bologna' },
    { slug: 'sassuolo', name: 'Sassuolo' },
    { slug: 'udinese', name: 'Udinese' },
    { slug: 'monza', name: 'Monza' },
    { slug: 'empoli', name: 'Empoli' },
    { slug: 'genoa', name: 'Genoa' },
    { slug: 'lecce', name: 'Lecce' },
    { slug: 'hellas-verona', name: 'Hellas Verona' },
    { slug: 'cagliari', name: 'Cagliari' },
    { slug: 'frosinone', name: 'Frosinone' },
    { slug: 'salernitana', name: 'Salernitana' },
  ],
  'france-ligue-1-2025-2026.football-logos.cc': [
    { slug: 'psg', name: 'Paris Saint-Germain' },
    { slug: 'marseille', name: 'Marseille' },
    { slug: 'lyon', name: 'Lyon' },
    { slug: 'monaco', name: 'Monaco' },
    { slug: 'lille', name: 'Lille' },
    { slug: 'nice', name: 'Nice' },
    { slug: 'rennes', name: 'Rennes' },
    { slug: 'lens', name: 'Lens' },
    { slug: 'strasbourg', name: 'Strasbourg' },
    { slug: 'reims', name: 'Reims' },
    { slug: 'nantes', name: 'Nantes' },
    { slug: 'montpellier', name: 'Montpellier' },
    { slug: 'toulouse', name: 'Toulouse' },
    { slug: 'lorient', name: 'Lorient' },
    { slug: 'brest', name: 'Brest' },
    { slug: 'metz', name: 'Metz' },
    { slug: 'le-havre', name: 'Le Havre' },
    { slug: 'clermont', name: 'Clermont' },
  ],
}

// Fallback: use actual file listing for all other leagues
const ALL_LEAGUES = getLeagueFolders()

export default function SelectTeamPage() {
  const router = useRouter()
  const supabase = createClient()

  const [selectedLeague, setSelectedLeague] = useState('')
  const [teams, setTeams] = useState<Array<{ slug: string; name: string }>>([])
  const [dbTeams, setDbTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<{ slug: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmStep, setConfirmStep] = useState(false)

  // Load all existing teams from DB for this league
  useEffect(() => {
    if (!selectedLeague) return
    const t = TEAM_REGISTRY[selectedLeague] ?? []
    setTeams(t)
    setSelectedTeam(null)

    supabase
      .from('teams')
      .select('*, profiles!manager_id(username)')
      .eq('logo_league_folder', selectedLeague)
      .then(({ data }) => setDbTeams(data ?? []))
  }, [selectedLeague])

  function getDbTeam(slug: string) {
    return dbTeams.find((t) => t.logo_team_slug === slug) ?? null
  }

  async function handleConfirm() {
    if (!selectedTeam) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const existing = getDbTeam(selectedTeam.slug)

    if (existing) {
      if (existing.manager_id) {
        setError('This team already has a manager. It will become available if their manager is removed.')
        setLoading(false)
        return
      }
      // Update existing team
      const { error: e } = await supabase
        .from('teams')
        .update({ manager_id: user.id })
        .eq('id', existing.id)

      if (e) { setError(e.message); setLoading(false); return }

      const avatarUrl = getTeamLogo(selectedLeague, selectedTeam.slug, 'profile_avatar')
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
    } else {
      // Create team
      const avatarUrl = getTeamLogo(selectedLeague, selectedTeam.slug, 'profile_avatar')
      const { error: e } = await supabase.from('teams').insert({
        name: selectedTeam.name,
        logo_league_folder: selectedLeague,
        logo_team_slug: selectedTeam.slug,
        manager_id: user.id,
      })

      if (e) { setError(e.message); setLoading(false); return }
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0a1128] px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center mb-3">
            <span className="text-[#0a1128] font-black text-lg">EFA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Choose Your Team</h1>
          <p className="text-slate-400 text-sm mt-1">First come, first served</p>
        </div>

        <div className="card p-6 space-y-5">
          {/* League selector */}
          <div>
            <label className="form-label">League / Country</label>
            <select
              className="input-field"
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
            >
              <option value="">Select a league…</option>
              {ALL_LEAGUES.map((folder) => (
                <option key={folder} value={folder}>
                  {getLeagueDisplayName(folder)}
                </option>
              ))}
            </select>
          </div>

          {/* Team grid */}
          {selectedLeague && teams.length > 0 && (
            <div>
              <label className="form-label">Select Team</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
                {teams.map((team) => {
                  const dbTeam = getDbTeam(team.slug)
                  const isTaken = !!(dbTeam?.manager_id)
                  const isSelected = selectedTeam?.slug === team.slug

                  return (
                    <button
                      key={team.slug}
                      onClick={() => !isTaken && setSelectedTeam(team)}
                      disabled={isTaken}
                      className={`
                        flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
                        ${isTaken
                          ? 'opacity-40 cursor-not-allowed border-navy-border bg-navy-light'
                          : isSelected
                            ? 'border-[#c9a84c] bg-[#c9a84c]/10 shadow-[0_0_12px_rgba(201,168,76,0.2)]'
                            : 'border-navy-border bg-navy-light hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5'
                        }
                      `}
                    >
                      <div className="w-12 h-12 flex items-center justify-center">
                        <Image
                          src={getTeamLogo(selectedLeague, team.slug, 'fixture_card')}
                          alt={team.name}
                          width={48}
                          height={48}
                          className="object-contain w-full h-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                        />
                      </div>
                      <span className="text-[10px] text-center leading-tight text-slate-300 font-medium line-clamp-2">
                        {team.name}
                      </span>
                      {isTaken && (
                        <span className="text-[9px] text-red-400">Taken</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected team preview */}
          {selectedTeam && (
            <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4 flex items-center gap-4">
              <Image
                src={getTeamLogo(selectedLeague, selectedTeam.slug, 'fixture_card')}
                alt={selectedTeam.name}
                width={64}
                height={64}
                className="object-contain"
              />
              <div>
                <p className="font-semibold text-white">{selectedTeam.name}</p>
                <p className="text-xs text-slate-400">{getLeagueDisplayName(selectedLeague)}</p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selectedTeam || loading}
            className="btn-gold w-full justify-center py-3 disabled:opacity-40"
          >
            {loading ? 'Saving…' : `Confirm — ${selectedTeam?.name ?? 'Select a team'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
