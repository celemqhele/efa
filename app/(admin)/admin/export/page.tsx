export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ExportButton from './ExportButton'
import ExportControls from './ExportControls'

interface Props {
  searchParams: Promise<{
    date?: string
    tournaments?: string
    types?: string
  }>
}

const ACCENT: Record<string, string> = {
  league: '#c9a84c',
  ucl: '#3b82f6',
  europa: '#f97316',
  super_cup: '#a855f7',
}

const VALID_TYPES = ['fixtures', 'results', 'standings'] as const
type ExportType = (typeof VALID_TYPES)[number]

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[obj.getDay()]} ${d} ${months[m - 1]} ${y}`
}

function TeamLogoInline({
  folder,
  slug,
  size = 38,
}: {
  folder?: string | null
  slug?: string | null
  size?: number
}) {
  if (!folder || !slug) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/${folder}/128x128/${slug}.png`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
  )
}

function StandingsTable({
  rows,
  mode,
  accent,
}: {
  rows: any[]
  mode: 'league' | 'group'
  accent: string
}) {
  const rowEven: React.CSSProperties = { background: 'var(--export-row-bg)', borderRadius: '8px' }
  const rowOdd: React.CSSProperties = { background: 'transparent' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px 8px',
          color: 'var(--export-muted)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
        }}
      >
        <div style={{ width: '24px', textAlign: 'center' }}>#</div>
        <div style={{ flex: 1, marginLeft: '10px' }}>TEAM</div>
        <div style={{ width: '28px', textAlign: 'center' }}>P</div>
        <div style={{ width: '28px', textAlign: 'center' }}>W</div>
        <div style={{ width: '28px', textAlign: 'center' }}>D</div>
        <div style={{ width: '28px', textAlign: 'center' }}>L</div>
        <div style={{ width: '36px', textAlign: 'center' }}>GD</div>
        <div style={{ width: '36px', textAlign: 'center', color: accent }}>PTS</div>
        {mode === 'group' && <div style={{ width: '20px' }} />}
      </div>
      {rows.map((s: any, i: number) => {
        const gd = (s.goals_for ?? 0) - (s.goals_against ?? 0)
        const borderColor =
          mode === 'league'
            ? i < 12
              ? '#c9a84c'
              : '#3b82f6'
            : i < 2
            ? '#c9a84c'
            : 'transparent'
        return (
          <div
            key={s.id ?? i}
            style={{
              display: 'flex',
              alignItems: 'center',
              ...(i % 2 === 0 ? rowEven : rowOdd),
              padding: '10px 8px',
              borderLeft: `3px solid ${borderColor}`,
            }}
          >
            <div
              style={{
                width: '24px',
                textAlign: 'center',
                color: 'var(--export-muted)',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {i + 1}
            </div>
            <TeamLogoInline
              folder={s.team?.logo_league_folder}
              slug={s.team?.logo_team_slug}
              size={28}
            />
            <div
              style={{
                flex: 1,
                color: 'var(--export-text)',
                fontWeight: 600,
                fontSize: '13px',
                marginLeft: '6px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.team?.name ?? '—'}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.played}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.wins}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.draws}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.losses}
            </div>
            <div
              style={{
                width: '36px',
                textAlign: 'center',
                color: gd >= 0 ? 'var(--export-green)' : 'var(--export-red)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {gd > 0 ? `+${gd}` : gd}
            </div>
            <div
              style={{
                width: '36px',
                textAlign: 'center',
                color: accent,
                fontSize: '15px',
                fontWeight: 900,
              }}
            >
              {s.points}
            </div>
            {mode === 'group' && (
              <div style={{ width: '20px', textAlign: 'center' }}>
                {i < 2 && (
                  <span style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 700 }}>Q</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default async function ExportPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const today = new Date().toISOString().split('T')[0]
  const selectedDate = sp.date ?? today
  const formattedDate = formatDate(selectedDate)

  const defaultTournamentId = tournaments?.[0]?.id ?? ''
  const selectedTournamentIds: string[] = sp.tournaments
    ? sp.tournaments.split(',').filter(Boolean)
    : defaultTournamentId
    ? [defaultTournamentId]
    : []

  const selectedTypes: ExportType[] = sp.types
    ? sp.types
        .split(',')
        .filter((t): t is ExportType => VALID_TYPES.includes(t as ExportType))
    : ['fixtures']

  // Date range filter for fixtures/results
  const dateStart = `${selectedDate}T00:00:00`
  const dateEnd = `${selectedDate}T23:59:59`

  type CardData = {
    key: string
    tournament: { id: string; name: string; type: string }
    type: ExportType
    fixtures: any[]
    results: any[]
    standings: any[]
    groupStandings: Record<string, any[]>
  }

  const cards: CardData[] = []

  for (const tournamentId of selectedTournamentIds) {
    const tournament = tournaments?.find((t) => t.id === tournamentId)
    if (!tournament) continue

    for (const type of selectedTypes) {
      let fixtures: any[] = []
      let results: any[] = []
      let standings: any[] = []
      const groupStandings: Record<string, any[]> = {}

      if (type === 'fixtures') {
        const { data } = await supabase
          .from('fixtures')
          .select(
            `id, matchday, scheduled_date,
            home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
            away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug)`
          )
          .eq('tournament_id', tournamentId)
          .gte('scheduled_date', dateStart)
          .lte('scheduled_date', dateEnd)
          .order('scheduled_date', { ascending: true })
        fixtures = data ?? []
      }

      if (type === 'results') {
        const { data: ftFixtures } = await supabase
          .from('fixtures')
          .select(
            `id, matchday, scheduled_date, status,
            home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
            away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug)`
          )
          .eq('tournament_id', tournamentId)
          .eq('status', 'confirmed')
          .gte('scheduled_date', dateStart)
          .lte('scheduled_date', dateEnd)
          .order('scheduled_date', { ascending: true })

        const fixtureIds = (ftFixtures ?? []).map((f: any) => f.id)
        const { data: scoreRows } = fixtureIds.length
          ? await supabase
              .from('results')
              .select('fixture_id, home_score, away_score')
              .in('fixture_id', fixtureIds)
          : { data: [] }

        const scoresByFixture: Record<string, any> = {}
        for (const row of scoreRows ?? []) {
          scoresByFixture[(row as any).fixture_id] = row
        }

        results = (ftFixtures ?? [])
          .map((f: any) => ({ ...f, result: scoresByFixture[f.id] ?? null }))
          .filter((f: any) => f.result)
      }

      if (type === 'standings') {
        if (tournament.type === 'league') {
          const [{ data: participants }, { data: confirmedFixtures }] = await Promise.all([
            supabase
              .from('tournament_participants')
              .select('team_id, teams(id, name, logo_league_folder, logo_team_slug)')
              .eq('tournament_id', tournamentId),
            supabase
              .from('fixtures')
              .select('home_team_id, away_team_id, results(home_score, away_score, override_reason)')
              .eq('tournament_id', tournamentId)
              .eq('status', 'confirmed'),
          ])

          const map: Record<string, any> = {}
          for (const p of participants ?? []) {
            map[(p as any).team_id] = {
              id: (p as any).team_id,
              team: (p as any).teams,
              played: 0, wins: 0, draws: 0, losses: 0,
              goals_for: 0, goals_against: 0, points: 0,
            }
          }

          for (const f of confirmedFixtures ?? []) {
            const result = Array.isArray((f as any).results)
              ? (f as any).results[0]
              : (f as any).results
            if (!result) continue
            const { home_score: hs, away_score: as_, override_reason } = result
            if ((override_reason ?? '').toLowerCase().includes('both') && (override_reason ?? '').toLowerCase().includes('absent')) continue

            const homeWin = hs > as_, awayWin = as_ > hs, draw = hs === as_
            const hr = map[(f as any).home_team_id]
            const ar = map[(f as any).away_team_id]

            if (hr) {
              hr.played++; hr.wins += homeWin ? 1 : 0; hr.draws += draw ? 1 : 0; hr.losses += awayWin ? 1 : 0
              hr.goals_for += hs; hr.goals_against += as_
              hr.points += homeWin ? 3 : draw ? 1 : 0
            }
            if (ar) {
              ar.played++; ar.wins += awayWin ? 1 : 0; ar.draws += draw ? 1 : 0; ar.losses += homeWin ? 1 : 0
              ar.goals_for += as_; ar.goals_against += hs
              ar.points += awayWin ? 3 : draw ? 1 : 0
            }
          }

          standings = Object.values(map).sort((a: any, b: any) => {
            if (b.points !== a.points) return b.points - a.points
            const gdDiff = (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against)
            if (gdDiff !== 0) return gdDiff
            return b.goals_for - a.goals_for
          })
        } else {
          const [{ data: participants }, { data: confirmedFixtures }] = await Promise.all([
            supabase
              .from('tournament_participants')
              .select('team_id, group_name, team:teams(id, name, logo_league_folder, logo_team_slug)')
              .eq('tournament_id', tournamentId),
            supabase
              .from('fixtures')
              .select(
                `home_team_id, away_team_id, round_type,
                home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
                away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
                results(home_score, away_score, override_reason)`
              )
              .eq('tournament_id', tournamentId)
              .eq('status', 'confirmed')
              .eq('round_type', 'group'),
          ])

          const teamGroupMap: Record<string, string> = {}
          const rowMap: Record<string, any> = {}

          const ensureRow = (teamId: string, groupName: string, teamData?: any) => {
            const key = `${groupName}:${teamId}`
            if (!rowMap[key]) {
              rowMap[key] = {
                id: teamId, group_name: groupName, team_id: teamId,
                team: teamData ?? null,
                played: 0, wins: 0, draws: 0, losses: 0,
                goals_for: 0, goals_against: 0, points: 0,
              }
              if (!groupStandings[groupName]) groupStandings[groupName] = []
              groupStandings[groupName].push(rowMap[key])
            } else if (!rowMap[key].team && teamData) {
              rowMap[key].team = teamData
            }
            return rowMap[key]
          }

          for (const p of participants ?? []) {
            const teamId = (p as any).team_id
            const groupName = (p as any).group_name ?? 'A'
            if (!teamId) continue
            teamGroupMap[teamId] = groupName
            ensureRow(teamId, groupName, (p as any).team ?? (p as any).teams ?? null)
          }

          for (const f of confirmedFixtures ?? []) {
            const result = Array.isArray((f as any).results)
              ? (f as any).results[0]
              : (f as any).results
            if (!result) continue
            const { home_score: hs, away_score: as_, override_reason } = result
            if ((override_reason ?? '').toLowerCase().includes('both') && (override_reason ?? '').toLowerCase().includes('absent')) continue

            const homeTeamId = (f as any).home_team_id
            const awayTeamId = (f as any).away_team_id
            const groupName = teamGroupMap[homeTeamId] ?? teamGroupMap[awayTeamId] ?? 'A'
            const homeWin = hs > as_, awayWin = as_ > hs, draw = hs === as_
            const hr = ensureRow(homeTeamId, groupName, (f as any).home_team)
            const ar = ensureRow(awayTeamId, groupName, (f as any).away_team)

            hr.played++; ar.played++
            hr.wins += homeWin ? 1 : 0; ar.wins += awayWin ? 1 : 0
            hr.draws += draw ? 1 : 0; ar.draws += draw ? 1 : 0
            hr.losses += awayWin ? 1 : 0; ar.losses += homeWin ? 1 : 0
            hr.goals_for += hs; ar.goals_for += as_
            hr.goals_against += as_; ar.goals_against += hs
            hr.points += homeWin ? 3 : draw ? 1 : 0
            ar.points += awayWin ? 3 : draw ? 1 : 0
          }

          for (const g of Object.keys(groupStandings)) {
            groupStandings[g].sort((a: any, b: any) => {
              if (b.points !== a.points) return b.points - a.points
              const gdDiff = (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against)
              if (gdDiff !== 0) return gdDiff
              if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
              return (a.team?.name ?? '').localeCompare(b.team?.name ?? '')
            })
          }
        }
      }

      cards.push({ key: `${tournamentId}-${type}`, tournament, type, fixtures, results, standings, groupStandings })
    }
  }

  const cardStyle: React.CSSProperties = {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    width: '600px',
    background: 'var(--export-card-bg)',
    padding: '32px',
    borderRadius: '12px',
  }

  return (
    <>
      <style>{`
        html:not(.dark) .export-page {
          --export-card-bg: #ffffff;
          --export-row-bg: #f8fafc;
          --export-text: #0f172a;
          --export-muted: #64748b;
          --export-muted-strong: #475569;
          --export-soft-text: #64748b;
          --export-score-divider: #94a3b8;
          --export-divider: #e2e8f0;
          --export-green: #16a34a;
          --export-red: #dc2626;
        }
        html.dark .export-page {
          --export-card-bg: #0a1128;
          --export-row-bg: #0f1a3d;
          --export-text: #ffffff;
          --export-muted: #64748b;
          --export-muted-strong: #475569;
          --export-soft-text: #94a3b8;
          --export-score-divider: #334155;
          --export-divider: #1e2d5a;
          --export-green: #4ade80;
          --export-red: #f87171;
        }
      `}</style>

      <div className="export-page space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Export</h1>
          <p className="text-slate-400 text-sm mt-1">Generate shareable PNG cards for WhatsApp</p>
        </div>

        <ExportControls
          tournaments={tournaments ?? []}
          defaultDate={selectedDate}
          defaultTournamentIds={selectedTournamentIds}
          defaultTypes={selectedTypes}
        />

        {/* Generated cards */}
        {cards.map((card, i) => {
          const accent = ACCENT[card.tournament.type] ?? '#c9a84c'
          const rowEven: React.CSSProperties = { background: 'var(--export-row-bg)', borderRadius: '8px' }
          const rowOdd: React.CSSProperties = { background: 'transparent' }

          const allData = card.type === 'fixtures' ? card.fixtures : card.results
          const matchdays = [...new Set(allData.map((f: any) => f.matchday).filter(Boolean))].sort((a, b) => a - b)
          const mdPrefix = matchdays.length === 1 ? `MATCHDAY ${matchdays[0]} ` : ''

          const typeLabel =
            card.type === 'fixtures'
              ? `${mdPrefix}FIXTURES`
              : card.type === 'results'
              ? `${mdPrefix}RESULTS`
              : card.tournament.type === 'league'
              ? 'LEAGUE TABLE'
              : 'GROUP STANDINGS'

          const cardId = `export-card-${i}`
          const filename = `efa-${card.type}-${card.tournament.type}-${selectedDate}.png`

          return (
            <div key={card.key}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {card.tournament.name}
                  <span className="font-normal text-slate-400"> — </span>
                  <span className="capitalize">{card.type}</span>
                  {card.type !== 'standings' && (
                    <span className="font-normal text-slate-400 ml-1 text-xs">({formattedDate})</span>
                  )}
                </p>
                <ExportButton filename={filename} cardId={cardId} />
              </div>

              <div className="overflow-x-auto pb-4">
                <div id={cardId} style={cardStyle}>
                  {/* Card header */}
                  <div
                    style={{
                      borderBottom: `3px solid ${accent}`,
                      paddingBottom: '16px',
                      marginBottom: '24px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '44px', height: '44px', borderRadius: '50%',
                          background: accent, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 900, fontSize: '13px',
                          color: '#0a1128', letterSpacing: '0.02em', flexShrink: 0,
                        }}
                      >
                        EFA
                      </div>
                      <div>
                        <div
                          style={{
                            color: accent, fontWeight: 700, fontSize: '10px',
                            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px',
                          }}
                        >
                          {card.tournament.name}
                        </div>
                        <div
                          style={{
                            color: 'var(--export-text)', fontWeight: 900, fontSize: '20px',
                            lineHeight: 1, letterSpacing: '-0.01em',
                          }}
                        >
                          {typeLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FIXTURES */}
                  {card.type === 'fixtures' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {card.fixtures.length === 0 ? (
                        <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                          No fixtures found for {formattedDate}
                        </div>
                      ) : (
                        card.fixtures.map((f: any, fi: number) => (
                          <div
                            key={f.id}
                            style={{
                              display: 'flex', alignItems: 'center',
                              ...(fi % 2 === 0 ? rowEven : rowOdd),
                              padding: '10px 16px',
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '10px' }}>
                              <span style={{ color: 'var(--export-text)', fontWeight: 600, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(f.home_team as any)?.name ?? '—'}
                              </span>
                              <TeamLogoInline folder={(f.home_team as any)?.logo_league_folder} slug={(f.home_team as any)?.logo_team_slug} />
                            </div>
                            <div style={{ color: accent, fontWeight: 900, fontSize: '11px', minWidth: '32px', textAlign: 'center', letterSpacing: '0.05em' }}>
                              VS
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px' }}>
                              <TeamLogoInline folder={(f.away_team as any)?.logo_league_folder} slug={(f.away_team as any)?.logo_team_slug} />
                              <span style={{ color: 'var(--export-text)', fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(f.away_team as any)?.name ?? '—'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                      <div style={{ color: 'var(--export-muted)', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                        {formattedDate}
                      </div>
                    </div>
                  )}

                  {/* RESULTS */}
                  {card.type === 'results' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {card.results.length === 0 ? (
                        <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                          No results found for {formattedDate}
                        </div>
                      ) : (
                        card.results.map((f: any, fi: number) => {
                          const r = f.result
                          const homeWon = r && r.home_score > r.away_score
                          const awayWon = r && r.away_score > r.home_score
                          return (
                            <div
                              key={f.id}
                              style={{
                                display: 'flex', alignItems: 'center',
                                ...(fi % 2 === 0 ? rowEven : rowOdd),
                                padding: '10px 16px',
                              }}
                            >
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '10px' }}>
                                <span style={{ color: homeWon ? 'var(--export-text)' : 'var(--export-muted)', fontWeight: homeWon ? 700 : 400, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {(f.home_team as any)?.name ?? '—'}
                                </span>
                                <TeamLogoInline folder={(f.home_team as any)?.logo_league_folder} slug={(f.home_team as any)?.logo_team_slug} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '72px', justifyContent: 'center' }}>
                                <span style={{ color: homeWon ? accent : 'var(--export-text)', fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>{r?.home_score ?? '?'}</span>
                                <span style={{ color: 'var(--export-score-divider)', fontWeight: 700, fontSize: '13px' }}>–</span>
                                <span style={{ color: awayWon ? accent : 'var(--export-text)', fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>{r?.away_score ?? '?'}</span>
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px' }}>
                                <TeamLogoInline folder={(f.away_team as any)?.logo_league_folder} slug={(f.away_team as any)?.logo_team_slug} />
                                <span style={{ color: awayWon ? 'var(--export-text)' : 'var(--export-muted)', fontWeight: awayWon ? 700 : 400, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {(f.away_team as any)?.name ?? '—'}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                      {card.results.length > 0 && (
                        <div style={{ color: 'var(--export-muted)', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                          {formattedDate}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STANDINGS (league) */}
                  {card.type === 'standings' && card.tournament.type === 'league' && (
                    <>
                      <StandingsTable rows={card.standings} mode="league" accent={accent} />
                      <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c9a84c' }} />
                          <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>UCL (1–12)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                          <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Europa (13–20)</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* STANDINGS (group) */}
                  {card.type === 'standings' && card.tournament.type !== 'league' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {Object.keys(card.groupStandings).length === 0 ? (
                        <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                          No standings data available
                        </div>
                      ) : (
                        <>
                          {Object.entries(card.groupStandings)
                            .sort()
                            .map(([group, rows]) => (
                              <div key={group}>
                                <div
                                  style={{
                                    color: accent, fontWeight: 700, fontSize: '11px',
                                    letterSpacing: '0.1em', marginBottom: '10px',
                                  }}
                                >
                                  GROUP {group}
                                </div>
                                <StandingsTable rows={rows} mode="group" accent={accent} />
                              </div>
                            ))}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c9a84c' }} />
                            <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Top 2 from each group qualify</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div
                    style={{
                      borderTop: '1px solid var(--export-divider)',
                      marginTop: '24px', paddingTop: '14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div style={{ color: 'var(--export-muted-strong)', fontSize: '10px', letterSpacing: '0.06em' }}>
                      EFA — EFOOTBALL FEDERAL ASSOCIATION
                    </div>
                    <div style={{ color: 'var(--export-muted-strong)', fontSize: '10px' }}>
                      efa-fxyk.vercel.app
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
