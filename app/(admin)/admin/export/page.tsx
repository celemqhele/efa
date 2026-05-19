export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import ExportButton from './ExportButton'

interface Props {
  searchParams: Promise<{
    type?: string
    tournament_id?: string
    matchday?: string
  }>
}

const ACCENT: Record<string, string> = {
  league: '#c9a84c',
  ucl: '#3b82f6',
  europa: '#f97316',
  super_cup: '#a855f7',
}

export default async function ExportPage({ searchParams }: Props) {
  const sp = await searchParams
  const type = (sp.type ?? 'fixtures') as 'fixtures' | 'results' | 'standings'
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: true })

  const activeTournamentId = sp.tournament_id ?? tournaments?.[0]?.id ?? null
  const selectedTournament = tournaments?.find((t) => t.id === activeTournamentId)
  const accent = ACCENT[selectedTournament?.type ?? 'league'] ?? '#c9a84c'

  // Matchday list for the selected tournament
  const { data: mdRows } = activeTournamentId
    ? await supabase
        .from('fixtures')
        .select('matchday')
        .eq('tournament_id', activeTournamentId)
        .order('matchday', { ascending: true })
    : { data: null }

  const matchdays = Array.from(new Set((mdRows ?? []).map((r) => r.matchday))).sort(
    (a, b) => a - b
  )
  const selectedMatchday = sp.matchday ? parseInt(sp.matchday) : (matchdays[0] ?? 1)

  // ── Data fetching based on type ──────────────────────────────────────────────

  let fixtures: any[] = []
  let results: any[] = []
  let standings: any[] = []
  const groupStandings: Record<string, any[]> = {}

  if (activeTournamentId) {
    if (type === 'fixtures') {
      const { data } = await supabase
        .from('fixtures')
        .select(`
          id, matchday, scheduled_date,
          home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
          away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug)
        `)
        .eq('tournament_id', activeTournamentId)
        .eq('matchday', selectedMatchday)
        .order('scheduled_date', { ascending: true })
      fixtures = data ?? []
    }

    if (type === 'results') {
      const { data } = await supabase
        .from('fixtures')
        .select(`
          id, matchday, scheduled_date,
          home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
          away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug),
          results(home_score, away_score)
        `)
        .eq('tournament_id', activeTournamentId)
        .eq('matchday', selectedMatchday)
        .order('scheduled_date', { ascending: true })
      results = (data ?? []).filter((f: any) => (f.results?.length ?? 0) > 0)
    }

    if (type === 'standings') {
      const tType = selectedTournament?.type
      if (tType === 'league') {
        const { data } = await supabase
          .from('standings')
          .select('*, team:teams(name, logo_league_folder, logo_team_slug)')
          .eq('tournament_id', activeTournamentId)
          .order('points', { ascending: false })
          .order('goals_for', { ascending: false })
        standings = data ?? []

        // If no matches played yet, build zero-rows from fixture team list
        if (standings.length === 0) {
          const { data: fxTeams } = await supabase
            .from('fixtures')
            .select('home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug), away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)')
            .eq('tournament_id', activeTournamentId)
          const seen = new Set<string>()
          const zeroRows: any[] = []
          for (const fx of fxTeams ?? []) {
            for (const [tid, tobj] of [
              [fx.home_team_id, fx.home_team],
              [fx.away_team_id, fx.away_team],
            ] as [string | null, any][]) {
              if (tid && !seen.has(tid)) {
                seen.add(tid)
                zeroRows.push({ team_id: tid, team: tobj, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, points: 0 })
              }
            }
          }
          standings = zeroRows.sort((a, b) => (a.team?.name ?? '').localeCompare(b.team?.name ?? ''))
        }
      } else {
        // UCL / Europa — show group standings
        const { data } = await (supabase.from('group_standings') as any)
          .select('*, team:teams(name, logo_league_folder, logo_team_slug)')
          .eq('tournament_id', activeTournamentId)
          .order('points', { ascending: false })
          .order('goals_for', { ascending: false })
        const rows: any[] = data ?? []
        for (const row of rows) {
          const g = row.group_name ?? 'A'
          if (!groupStandings[g]) groupStandings[g] = []
          groupStandings[g].push(row)
        }
      }
    }
  }

  const fixtureDate =
    fixtures[0]?.scheduled_date
      ? format(new Date(fixtures[0].scheduled_date), 'EEEE d MMMM yyyy')
      : null

  const typeLabel =
    type === 'fixtures'
      ? `MATCHDAY ${selectedMatchday} FIXTURES`
      : type === 'results'
      ? `MATCHDAY ${selectedMatchday} RESULTS`
      : selectedTournament?.type === 'league'
      ? 'LEAGUE TABLE'
      : 'GROUP STANDINGS'

  const filename = `efa-${type}-${selectedTournament?.type ?? 'export'}-md${selectedMatchday}.png`

  // ── Inline-style card helpers ────────────────────────────────────────────────

  const card: React.CSSProperties = {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    width: '600px',
    background: '#0a1128',
    padding: '32px',
    borderRadius: '12px',
  }

  const rowEven: React.CSSProperties = { background: '#0f1a3d', borderRadius: '8px' }
  const rowOdd: React.CSSProperties = { background: 'transparent' }

  function TeamLogoInline({ folder, slug, size = 38 }: { folder?: string | null; slug?: string | null; size?: number }) {
    if (!folder || !slug) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/logos/${folder}/128x128/${slug}.png`}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block', background: '#ffffff', flexShrink: 0 }}
      />
    )
  }

  function StandingsTable({ rows, mode }: { rows: any[]; mode: 'league' | 'group' }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px 8px', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>
          <div style={{ width: '24px', textAlign: 'center' }}>#</div>
          <div style={{ flex: 1, marginLeft: '10px' }}>TEAM</div>
          <div style={{ width: '28px', textAlign: 'center' }}>P</div>
          <div style={{ width: '28px', textAlign: 'center' }}>W</div>
          <div style={{ width: '28px', textAlign: 'center' }}>D</div>
          <div style={{ width: '28px', textAlign: 'center' }}>L</div>
          <div style={{ width: '36px', textAlign: 'center' }}>GD</div>
          <div style={{ width: mode === 'group' ? '28px' : '36px', textAlign: 'center', color: accent }}>{mode === 'group' ? 'PTS' : 'PTS'}</div>
          {mode === 'group' && <div style={{ width: '20px' }} />}
        </div>

        {rows.map((s: any, i: number) => {
          const gd = (s.goals_for ?? 0) - (s.goals_against ?? 0)
          // League: UCL = top 12 (gold), Europa = 13-20 (blue)
          // Group:  qualify = top 2 (gold)
          const borderColor = mode === 'league'
            ? i < 12 ? '#c9a84c' : '#3b82f6'
            : i < 2 ? '#c9a84c' : 'transparent'
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
              <div style={{ width: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontWeight: 700 }}>{i + 1}</div>
              <TeamLogoInline folder={s.team?.logo_league_folder} slug={s.team?.logo_team_slug} size={28} />
              <div style={{ flex: 1, color: '#ffffff', fontWeight: 600, fontSize: '13px', marginLeft: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.team?.name ?? '—'}
              </div>
              <div style={{ width: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{s.played}</div>
              <div style={{ width: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{s.wins}</div>
              <div style={{ width: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{s.draws}</div>
              <div style={{ width: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{s.losses}</div>
              <div style={{ width: '36px', textAlign: 'center', color: gd >= 0 ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: 600 }}>
                {gd > 0 ? `+${gd}` : gd}
              </div>
              <div style={{ width: mode === 'group' ? '28px' : '36px', textAlign: 'center', color: accent, fontSize: '15px', fontWeight: 900 }}>{s.points}</div>
              {mode === 'group' && (
                <div style={{ width: '20px', textAlign: 'center' }}>
                  {i < 2 && <span style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 700 }}>Q</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Export</h1>
          <p className="text-slate-400 text-sm mt-1">Generate shareable PNG cards for WhatsApp</p>
        </div>
        <ExportButton filename={filename} />
      </div>

      {/* Type tabs */}
      <div className="flex gap-2">
        {(['fixtures', 'results', 'standings'] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/export?type=${t}&tournament_id=${activeTournamentId ?? ''}&matchday=${selectedMatchday}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors border ${
              type === t
                ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                : 'text-slate-500 border-slate-200 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Tournament selector */}
      {(tournaments ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {(tournaments ?? []).map((t) => (
            <Link
              key={t.id}
              href={`/admin/export?type=${type}&tournament_id=${t.id}&matchday=${selectedMatchday}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                t.id === activeTournamentId
                  ? 'bg-[#c9a84c]/20 text-[#c9a84c] border-[#c9a84c]/60'
                  : 'text-slate-500 border-slate-200 hover:text-[#c9a84c]'
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {/* Matchday selector (fixtures + results only) */}
      {type !== 'standings' && matchdays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {matchdays.map((md) => (
            <Link
              key={md}
              href={`/admin/export?type=${type}&tournament_id=${activeTournamentId ?? ''}&matchday=${md}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                md === selectedMatchday
                  ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                  : 'text-slate-500 border-slate-200 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
              }`}
            >
              MD {md}
            </Link>
          ))}
        </div>
      )}

      {/* ── Card preview (this div is what gets exported) ────────────────── */}
      <div className="overflow-x-auto pb-4">
        <div id="export-card" style={card}>

          {/* Header */}
          <div style={{ borderBottom: `3px solid ${accent}`, paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '13px', color: '#0a1128', letterSpacing: '0.02em', flexShrink: 0,
              }}>
                EFA
              </div>
              <div>
                <div style={{ color: accent, fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
                  {selectedTournament?.name ?? 'EFA'}
                </div>
                <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '20px', lineHeight: 1, letterSpacing: '-0.01em' }}>
                  {typeLabel}
                </div>
              </div>
            </div>
          </div>

          {/* ── FIXTURES ──────────────────────────────────────────────────── */}
          {type === 'fixtures' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {fixtures.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                  No fixtures found for Matchday {selectedMatchday}
                </div>
              ) : (
                fixtures.map((f: any, i: number) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      ...(i % 2 === 0 ? rowEven : rowOdd),
                      padding: '10px 16px',
                    }}
                  >
                    {/* Home side — name right-aligned, logo nearest center */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '10px' }}>
                      <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(f.home_team as any)?.name ?? '—'}
                      </span>
                      <TeamLogoInline folder={(f.home_team as any)?.logo_league_folder} slug={(f.home_team as any)?.logo_team_slug} />
                    </div>

                    <div style={{ color: accent, fontWeight: 900, fontSize: '11px', minWidth: '32px', textAlign: 'center', letterSpacing: '0.05em' }}>
                      VS
                    </div>

                    {/* Away side — logo nearest center, name left-aligned */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px' }}>
                      <TeamLogoInline folder={(f.away_team as any)?.logo_league_folder} slug={(f.away_team as any)?.logo_team_slug} />
                      <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(f.away_team as any)?.name ?? '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
              {fixtureDate && (
                <div style={{ color: '#64748b', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                  {fixtureDate}
                </div>
              )}
            </div>
          )}

          {/* ── RESULTS ───────────────────────────────────────────────────── */}
          {type === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {results.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                  No results yet for Matchday {selectedMatchday}
                </div>
              ) : (
                results.map((f: any, i: number) => {
                  const r = f.results?.[0]
                  const homeWon = r && r.home_score > r.away_score
                  const awayWon = r && r.away_score > r.home_score
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex', alignItems: 'center',
                        ...(i % 2 === 0 ? rowEven : rowOdd),
                        padding: '10px 16px',
                      }}
                    >
                      {/* Home — name right-aligned, logo nearest center */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '10px' }}>
                        <span style={{ color: homeWon ? '#ffffff' : '#64748b', fontWeight: homeWon ? 700 : 400, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(f.home_team as any)?.name ?? '—'}
                        </span>
                        <TeamLogoInline folder={(f.home_team as any)?.logo_league_folder} slug={(f.home_team as any)?.logo_team_slug} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '72px', justifyContent: 'center' }}>
                        <span style={{ color: homeWon ? accent : '#ffffff', fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>{r?.home_score ?? '?'}</span>
                        <span style={{ color: '#334155', fontWeight: 700, fontSize: '13px' }}>–</span>
                        <span style={{ color: awayWon ? accent : '#ffffff', fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>{r?.away_score ?? '?'}</span>
                      </div>
                      {/* Away — logo nearest center, name left-aligned */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px' }}>
                        <TeamLogoInline folder={(f.away_team as any)?.logo_league_folder} slug={(f.away_team as any)?.logo_team_slug} />
                        <span style={{ color: awayWon ? '#ffffff' : '#64748b', fontWeight: awayWon ? 700 : 400, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(f.away_team as any)?.name ?? '—'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ── STANDINGS (league) ────────────────────────────────────────── */}
          {type === 'standings' && selectedTournament?.type === 'league' && (
            <>
              <StandingsTable rows={standings} mode="league" />
              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c9a84c' }} />
                  <span style={{ color: '#64748b', fontSize: '10px' }}>UCL (1–12)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                  <span style={{ color: '#64748b', fontSize: '10px' }}>Europa (13–20)</span>
                </div>
              </div>
            </>
          )}

          {/* ── STANDINGS (UCL / Europa — grouped) ───────────────────────── */}
          {type === 'standings' && selectedTournament?.type !== 'league' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.keys(groupStandings).length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                  No standings data available
                </div>
              ) : (
                <>
                  {Object.entries(groupStandings).sort().map(([group, rows]) => (
                    <div key={group}>
                      <div style={{ color: accent, fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', marginBottom: '10px' }}>
                        GROUP {group}
                      </div>
                      <StandingsTable rows={rows} mode="group" />
                    </div>
                  ))}
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c9a84c' }} />
                    <span style={{ color: '#64748b', fontSize: '10px' }}>Top 2 from each group qualify</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1e2d5a', marginTop: '24px', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '0.06em' }}>
              EFA — EFOOTBALL FEDERAL ASSOCIATION
            </div>
            <div style={{ color: '#475569', fontSize: '10px' }}>
              efa-fxyk.vercel.app
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
