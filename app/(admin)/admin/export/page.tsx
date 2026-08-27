import React from 'react'
import { createClient } from '@/lib/supabase/server'
import ExportButton from './ExportButton'
import ExportControls from './ExportControls'
import { Card } from '@/components/ui/Card'
import { buildLiveStandings, goalDifference } from '@/lib/standings-core'
import { Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    date?: string
    tournaments?: string
    types?: string
  }>
}

const ACCENT: Record<string, string> = {
  league: 'var(--color-accent)',
  ucl: '#3b82f6',
  europa: '#f97316',
  super_cup: '#a855f7',
}

const VALID_TYPES = ['fixtures', 'results', 'standings', 'managers'] as const
type ExportType = (typeof VALID_TYPES)[number]

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[obj.getDay()]} ${d} ${months[m - 1]} ${y}`
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${days[obj.getDay()]} ${d} ${months[m - 1]}`
}

function formatDateRange(dates: string[]): string {
  const unique = Array.from(new Set(dates)).sort()
  if (unique.length === 0) return 'FIXTURES'
  if (unique.length === 1) return formatDate(unique[0])
  return `${formatDateShort(unique[0])} – ${formatDateShort(unique[unique.length - 1])}`
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
  if (!folder || !slug) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0 }}>
        <Shield className="text-text-muted" size={size * 0.75} strokeWidth={1.5} />
      </span>
    )
  }
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
  offset = 0,
  qualifiersPerGroup = 2,
}: {
  rows: any[]
  mode: 'league' | 'group'
  accent: string
  offset?: number
  qualifiersPerGroup?: number
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
        const gd = goalDifference(s)
        const pos = i + offset
        const borderColor =
          mode === 'league'
            ? pos < 12
              ? 'var(--color-accent)'
              : pos < 20
              ? '#3b82f6'
              : 'transparent'
            : pos < qualifiersPerGroup ? 'var(--color-accent)' : 'transparent'
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
              {pos + 1}
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
                {pos < qualifiersPerGroup && (
                  <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 700 }}>Q</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

type CardData = {
  key: string
  tournament: { id: string; name: string; type: string; settings?: any }
  type: ExportType
  fixtures: any[]
  results: any[]
  standings: any[]
  groupStandings: Record<string, any[]>
  managers: any[]
  // Chunking support
  isChunked?: boolean
  chunks?: {
    key: string
    title: string
    groupStandings?: Record<string, any[]>
    managers?: any[]
    standings?: any[]
    standingsOffset?: number
    fixtures?: any[]
    results?: any[]
  }[]
}

export default async function ExportPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: _tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, type, status, settings')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  const tournaments = (_tournaments ?? []) as any[]
  const queryErrors: string[] = []
  if (tournamentsError) queryErrors.push(tournamentsError.message)

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

  const cards: CardData[] = []

  for (const tournamentId of selectedTournamentIds) {
    const tournament = tournaments?.find((t) => t.id === tournamentId)
    if (!tournament) continue

    for (const cardType of selectedTypes) {
      let fixtures: any[] = []
      let results: any[] = []
      let standings: any[] = []
      let groupStandings: Record<string, any[]> = {}
      let managers: any[] = []
      let isChunked = false
      const chunks: any[] = []

      if (cardType === 'fixtures') {
        const { data, error: fxErr } = await supabase
          .from('fixtures')
          .select(
            `id, matchday, scheduled_date, status,
            home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
            away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug)`
          )
          .eq('tournament_id', tournamentId)
          .gte('scheduled_date', dateStart)
          .lte('scheduled_date', dateEnd)
          .in('status', ['scheduled', 'awaiting_confirmation'])
          .order('scheduled_date', { ascending: true })
        if (fxErr) queryErrors.push(fxErr.message)
        fixtures = data ?? []
        if (fixtures.length > 6) {
          isChunked = true
          const fixtureChunkSize = 6
          for (let i = 0; i < fixtures.length; i += fixtureChunkSize) {
            const partNum = Math.floor(i / fixtureChunkSize) + 1
            const chunkFixtures = fixtures.slice(i, i + fixtureChunkSize)
            const dates = chunkFixtures.map((f: any) => f.scheduled_date?.split('T')[0]).filter(Boolean)
            const dateLabel = formatDateRange(dates)
            chunks.push({
              key: `${tournamentId}-${cardType}-chunk-${partNum}`,
              title: `${dateLabel} (PART ${partNum})`,
              fixtures: chunkFixtures
            })
          }
        }
      }

      if (cardType === 'results') {
        const { data: ftFixtures, error: fxErr } = await supabase
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
        if (fxErr) queryErrors.push(fxErr.message)

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
        if (results.length > 6) {
          if (!isChunked) isChunked = true
          const resultChunkSize = 6
          for (let i = 0; i < results.length; i += resultChunkSize) {
            const partNum = Math.floor(i / resultChunkSize) + 1
            const chunkResults = results.slice(i, i + resultChunkSize)
            const dates = chunkResults.map((f: any) => f.scheduled_date?.split('T')[0]).filter(Boolean)
            const dateLabel = formatDateRange(dates)
            chunks.push({
              key: `${tournamentId}-${cardType}-chunk-${partNum}`,
              title: `${dateLabel} (PART ${partNum})`,
              results: chunkResults
            })
          }
        }
      }

      if (cardType === 'standings') {
        const { leagueStandings, groupStandings: gs } = await buildLiveStandings(supabase, tournamentId, tournament.type)
        standings = leagueStandings
        
        if (tournament.type !== 'league') {
          isChunked = true
          const groupEntries = Object.entries(gs).sort()
          for (const [group, rows] of groupEntries) {
            chunks.push({
              key: `${tournamentId}-${cardType}-group-${group}`,
              title: `GROUP ${group}`,
              groupStandings: { [group]: rows }
            })
          }
        } else {
          groupStandings = gs
          if (leagueStandings.length > 12) {
            isChunked = true
            const halfCount = Math.ceil(leagueStandings.length / 2)
            chunks.push({
              key: `${tournamentId}-${cardType}-chunk-1`,
              title: 'LEAGUE TABLE (FIRST HALF)',
              standings: leagueStandings.slice(0, halfCount),
              standingsOffset: 0
            })
            chunks.push({
              key: `${tournamentId}-${cardType}-chunk-2`,
              title: 'LEAGUE TABLE (SECOND HALF)',
              standings: leagueStandings.slice(halfCount),
              standingsOffset: halfCount
            })
          }
        }
      }

      if (cardType === 'managers') {
        const { data: playingFixtures, error: pfxErr } = await supabase
          .from('fixtures')
          .select('home_team_id, away_team_id')
          .eq('tournament_id', tournamentId)
          .eq('status', 'scheduled')
          .gte('scheduled_date', dateStart)
          .lte('scheduled_date', dateEnd)
        if (pfxErr) queryErrors.push(pfxErr.message)

        const teamIds = [...new Set<string>(
          (playingFixtures ?? []).flatMap(f => [f.home_team_id, f.away_team_id])
        )]
        if (teamIds.length > 0) {
          const { data: teamData } = await supabase
            .from('teams')
            .select(`
              id, name, logo_league_folder, logo_team_slug,
              manager:profiles!teams_manager_id_fkey(username, phone)
            `)
            .in('id', teamIds)
            .order('name', { ascending: true })
          const allManagers = teamData ?? []

          if (allManagers.length > 10) {
            isChunked = true
            const managerChunkSize = 10
            for (let i = 0; i < allManagers.length; i += managerChunkSize) {
              const partNum = Math.floor(i / managerChunkSize) + 1
              chunks.push({
                key: `${tournamentId}-${cardType}-chunk-${partNum}`,
                title: `MANAGERS (PART ${partNum})`,
                managers: allManagers.slice(i, i + managerChunkSize)
              })
            }
          } else {
            managers = allManagers
          }
        }
      }

      cards.push({ 
        key: `${tournamentId}-${cardType}`, 
        tournament, 
        type: cardType, 
        fixtures, 
        results, 
        standings, 
        groupStandings, 
        managers,
        isChunked,
        chunks
      })
    }
  }

  const cardStyle: React.CSSProperties = {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    width: '600px',
    minHeight: '540px',
    background: 'var(--export-card-bg)',
    padding: '32px',
    borderRadius: '12px',
  }

  return (
    <div className="space-y-space-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Export</h1>
        <p className="text-text-muted text-sm mt-space-1">Generate shareable PNG cards for WhatsApp</p>
      </div>

      <ExportControls
        tournaments={tournaments ?? []}
        defaultDate={selectedDate}
        defaultTournamentIds={selectedTournamentIds}
        defaultTypes={selectedTypes}
      />

      {queryErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm space-y-1">
          {queryErrors.map((err, i) => (
            <div key={i}>Error: {err}</div>
          ))}
        </div>
      )}

      {cards.length === 0 && !queryErrors.length && (
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-muted space-y-3">
          <p className="text-sm">No data to display.</p>
          <p className="text-xs text-text-muted/70">Select a tournament and content type above, then update to generate export cards.</p>
        </div>
      )}

      {/* Generated cards */}
      {cards.map((card, i) => {
        const accent = ACCENT[card.tournament.type] ?? 'var(--color-accent)'
        const rowEven: React.CSSProperties = { background: 'var(--export-row-bg)', borderRadius: '8px' }
        const rowOdd: React.CSSProperties = { background: 'transparent' }

        const allData = card.type === 'fixtures' ? card.fixtures : card.results
        const dates = allData.map((f: any) => f.scheduled_date?.split('T')[0]).filter(Boolean)
        const datePrefix = dates.length > 0 ? `${formatDateRange(dates)} ` : ''

        const typeLabel =
          card.type === 'fixtures'
            ? `${datePrefix}FIXTURES`
            : card.type === 'results'
            ? `${datePrefix}RESULTS`
            : card.tournament.type === 'league'
            ? 'LEAGUE TABLE'
            : 'GROUP STANDINGS'

        const filename = `efa-${card.type}-${card.tournament.type}-${selectedDate}.png`

        // If chunked, we render multiple cards and one button for all
        if (card.isChunked && card.chunks) {
          const chunkIds = card.chunks.map(c => c.key)
          return (
            <div key={card.key} className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-text-secondary">
                  {card.tournament.name}
                  <span className="font-normal text-text-muted"> — </span>
                  <span className="capitalize">{card.type}</span>
                </p>
                <ExportButton filename={filename} cardIds={chunkIds} />
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {card.chunks.map((chunk) => (
                  <div key={chunk.key} className="overflow-x-auto pb-space-4">
                    <Card id={chunk.key} style={cardStyle} className="p-space-8">
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
                              {chunk.title}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chunk Content: Standings (Group) */}
                      {chunk.groupStandings && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {Object.entries(chunk.groupStandings)
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
                                <StandingsTable rows={rows} mode="group" accent={accent} qualifiersPerGroup={card.tournament?.settings?.qualifiers_per_group ?? 2} />
                              </div>
                            ))}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-accent)' }} />
                            <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Top {card.tournament?.settings?.qualifiers_per_group ?? 2} qualify</span>
                          </div>
                        </div>
                      )}

                      {/* Chunk Content: Standings (League) */}
                      {chunk.standings && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <StandingsTable rows={chunk.standings} mode="league" accent={accent} offset={chunk.standingsOffset} />
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-accent)' }} />
                              <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>UCL places</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                              <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Europa places</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Chunk Content: Fixtures */}
                      {chunk.fixtures && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {chunk.fixtures.map((f: any, fi: number) => (
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
                          ))}
                          <div style={{ color: 'var(--export-muted)', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                            {formattedDate}
                          </div>
                        </div>
                      )}

                      {/* Chunk Content: Results */}
                      {chunk.results && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {chunk.results.map((f: any, fi: number) => {
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
                          })}
                          <div style={{ color: 'var(--export-muted)', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                            {formattedDate}
                          </div>
                        </div>
                      )}

                      {/* Chunk Content: Managers */}
                      {chunk.managers && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                          {chunk.managers.map((m: any) => {
                            const managerName = Array.isArray(m.manager) ? m.manager[0]?.username : m.manager?.username
                            const managerPhone = Array.isArray(m.manager) ? m.manager[0]?.phone : m.manager?.phone
                            return (
                              <div
                                key={m.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  background: 'var(--export-row-bg)', borderRadius: '8px',
                                  padding: '10px 12px',
                                }}
                              >
                                <TeamLogoInline folder={m.logo_league_folder} slug={m.logo_team_slug} size={28} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: 'var(--export-text)', fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.name}
                                  </div>
                                  <div style={{ color: accent, fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {managerName ?? 'VACANT'}
                                  </div>
                                  {managerPhone && (
                                    <div style={{ color: 'var(--export-muted)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {managerPhone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
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
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        const cardId = `export-card-${i}`
        return <div key={card.key}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text-secondary">
                {card.tournament.name}
                <span className="font-normal text-text-muted"> — </span>
                <span className="capitalize">{card.type}</span>
                {card.type !== 'standings' && (
                  <span className="font-normal text-text-muted ml-1 text-xs">({formattedDate})</span>
                )}
              </p>
              <ExportButton filename={filename} cardId={cardId} />
            </div>

            <div className="overflow-x-auto pb-space-4">
              <Card id={cardId} style={cardStyle} className="p-space-8">
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
                        {card.type === 'managers' ? 'MANAGERS' : typeLabel}
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
                {card.type === 'standings' && card.tournament.type === 'league' && !card.isChunked && (
                  <>
                    <StandingsTable rows={card.standings} mode="league" accent={accent} />
                    <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-accent)' }} />
                        <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>UCL places</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                        <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Europa places</span>
                      </div>
                    </div>
                  </>
                )}

                {/* STANDINGS (group - non-chunked) */}
                {card.type === 'standings' && card.tournament.type !== 'league' && !card.isChunked && (
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
                              <StandingsTable rows={rows} mode="group" accent={accent} qualifiersPerGroup={card.tournament?.settings?.qualifiers_per_group ?? 2} />
                            </div>
                          ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-accent)' }} />
                          <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Top {card.tournament?.settings?.qualifiers_per_group ?? 2} qualify</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* MANAGERS (non-chunked) */}
                {card.type === 'managers' && !card.isChunked && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {card.managers.length === 0 ? (
                      <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px', gridColumn: 'span 2' }}>
                        No managers found
                      </div>
                    ) : (
                      card.managers.map((m: any, mi: number) => {
                        const managerName = Array.isArray(m.manager) ? m.manager[0]?.username : m.manager?.username
                        const managerPhone = Array.isArray(m.manager) ? m.manager[0]?.phone : m.manager?.phone
                        return (
                          <div
                            key={m.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              background: 'var(--export-row-bg)', borderRadius: '8px',
                              padding: '10px 12px',
                            }}
                          >
                            <TeamLogoInline folder={m.logo_league_folder} slug={m.logo_team_slug} size={28} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--export-text)', fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.name}
                              </div>
                              <div style={{ color: accent, fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {managerName ?? 'VACANT'}
                              </div>
                              {managerPhone && (
                                <div style={{ color: 'var(--export-muted)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {managerPhone}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
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
              </Card>
            </div>
          </div>
      })}
    </div>
  )
}
