'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LeagueTableGraphic from './LeagueTableGraphic'
import FixtureCard from './FixtureCard'
import ResultGraphic from './ResultGraphic'
import GroupTableGraphic from './GroupTableGraphic'

interface Props {
  tournamentId: string
}

type Tab = 'league_table' | 'fixture_card' | 'result' | 'group_table' | 'gameweek'

const TABS: { id: Tab; label: string }[] = [
  { id: 'league_table', label: 'League Table' },
  { id: 'fixture_card', label: 'Fixture Card' },
  { id: 'result', label: 'Result Graphic' },
  { id: 'group_table', label: 'Group Table' },
  { id: 'gameweek', label: 'Gameweek Summary' },
]

interface TournamentData {
  name: string
  type: string
  standings: any[]
  fixtures: any[]
  results: any[]
  groups: Record<string, any[]>
  currentGameweek: number
}

function GameweekSummary({ fixtures, results, tournamentName }: { fixtures: any[]; results: any[]; tournamentName: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={async () => {
            const { exportElementAsPng } = await import('@/lib/broadcast-export')
            exportElementAsPng('broadcast-gameweek-summary', 'efa-gameweek-summary')
          }}
          className="btn-gold flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export PNG
        </button>
      </div>

      <div
        id="broadcast-gameweek-summary"
        style={{
          width: '100%',
          aspectRatio: '16/9',
          background: '#0a1128',
          fontFamily: "'Poppins', 'Arial', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #c9a84c 0%, #e0c06a 50%, #c9a84c 100%)',
              padding: '1.5% 3%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0a1128' }}>
              {tournamentName}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1128', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              GAMEWEEK SUMMARY
            </div>
          </div>

          {/* Results grid */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1%',
              padding: '2% 3%',
              overflowY: 'hidden',
            }}
          >
            {results.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#475569', fontSize: '14px', paddingTop: '10%' }}>
                No results for this gameweek yet.
              </div>
            )}
            {results.map((r: any, idx: number) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(17,28,61,0.8)',
                  border: '1px solid #1e2d5a',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {r.is_abandoned ? 'ABANDONED' : 'FT'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: '10px', fontWeight: 600, color: '#e2e8f0' }}>
                    {r.home_team_name ?? 'Home'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#c9a84c', letterSpacing: '0.05em', flexShrink: 0 }}>
                    {r.home_score} — {r.away_score}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', fontSize: '10px', fontWeight: 600, color: '#e2e8f0' }}>
                    {r.away_team_name ?? 'Away'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              background: '#111c3d',
              borderTop: '1px solid #1e2d5a',
              padding: '0.8% 3%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              EFA — Efootball Federal Association
            </div>
            <div style={{ fontSize: '9px', color: '#475569' }}>
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BroadcastPanel({ tournamentId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('league_table')
  const [data, setData] = useState<TournamentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fixture/result selectors for single-match templates
  const [selectedFixtureIdx, setSelectedFixtureIdx] = useState(0)
  const [selectedResultIdx, setSelectedResultIdx] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const supabase = createClient()

        // Fetch tournament info
        const { data: tournament, error: tErr } = await supabase
          .from('tournaments')
          .select('id, name, type')
          .eq('id', tournamentId)
          .single()

        if (tErr || !tournament) throw new Error('Tournament not found')

        // Fetch standings
        const { data: standings } = await supabase
          .from('standings')
          .select(`
            position, played, wins, draws, losses,
            goals_for, goals_against, goal_difference, points, form,
            teams (name, logo_league_folder, logo_team_slug)
          `)
          .eq('tournament_id', tournamentId)
          .order('position', { ascending: true })

        // Fetch upcoming fixtures
        const { data: fixtures } = await supabase
          .from('fixtures')
          .select(`
            id, scheduled_date, matchday, status,
            home:teams!home_team_id (name, logo_league_folder, logo_team_slug),
            away:teams!away_team_id (name, logo_league_folder, logo_team_slug)
          `)
          .eq('tournament_id', tournamentId)
          .eq('status', 'scheduled')
          .order('scheduled_date', { ascending: true })
          .limit(20)

        // Fetch recent results
        const { data: results } = await supabase
          .from('results')
          .select(`
            id, home_score, away_score, is_abandoned,
            fixtures (
              scheduled_date, matchday,
              home:teams!home_team_id (name, logo_league_folder, logo_team_slug),
              away:teams!away_team_id (name, logo_league_folder, logo_team_slug)
            )
          `)
          .eq('fixtures.tournament_id', tournamentId)
          .order('created_at', { ascending: false })
          .limit(20)

        // Fetch group standings if UCL/Europa
        const groups: Record<string, any[]> = {}
        if (tournament.type === 'ucl' || tournament.type === 'europa') {
          const { data: groupData } = await supabase
            .from('group_standings')
            .select(`
              group_name, played, wins, draws, losses,
              goals_for, goals_against, goal_difference, points,
              teams (name, logo_league_folder, logo_team_slug)
            `)
            .eq('tournament_id', tournamentId)
            .order('group_name', { ascending: true })
            .order('points', { ascending: false })

          for (const row of groupData ?? []) {
            if (!groups[row.group_name]) groups[row.group_name] = []
            groups[row.group_name].push({
              team: row.teams,
              played: row.played,
              wins: row.wins,
              draws: row.draws,
              losses: row.losses,
              goals_for: row.goals_for,
              goals_against: row.goals_against,
              goal_difference: row.goal_difference,
              points: row.points,
            })
          }
        }

        // Normalize standings
        const normalizedStandings = (standings ?? []).map((s: any) => ({
          position: s.position,
          team: s.teams,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goals_for: s.goals_for,
          goals_against: s.goals_against,
          goal_difference: s.goal_difference,
          points: s.points,
          form: s.form ?? '',
        }))

        // Normalize results for gameweek summary
        const normalizedResults = (results ?? []).map((r: any) => ({
          home_score: r.home_score,
          away_score: r.away_score,
          is_abandoned: r.is_abandoned,
          home_team_name: r.fixtures?.home?.name,
          away_team_name: r.fixtures?.away?.name,
        }))

        setData({
          name: tournament.name,
          type: tournament.type,
          standings: normalizedStandings,
          fixtures: fixtures ?? [],
          results: normalizedResults,
          groups,
          currentGameweek: (fixtures?.[0] as any)?.matchday ?? 1,
        })
      } catch (err: any) {
        setError(err.message ?? 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [tournamentId])

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400">Loading broadcast data...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-400">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const selectedFixture = data.fixtures[selectedFixtureIdx]
  const selectedResult = data.results[selectedResultIdx]

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-[#111c3d] rounded-xl border border-[#1e2d5a] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-[#c9a84c] text-[#0a1128]'
                : 'text-slate-400 hover:text-white hover:bg-[#1e2d5a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {/* League Table */}
        {activeTab === 'league_table' && (
          <div className="space-y-4">
            {data.standings.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">No standings data available.</div>
            ) : (
              <LeagueTableGraphic standings={data.standings} tournamentName={data.name} />
            )}
          </div>
        )}

        {/* Fixture Card */}
        {activeTab === 'fixture_card' && (
          <div className="space-y-4">
            {data.fixtures.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">No upcoming fixtures.</div>
            ) : (
              <>
                {data.fixtures.length > 1 && (
                  <div className="card p-4">
                    <label className="block text-xs font-semibold text-[#c9a84c] uppercase tracking-wider mb-2">
                      Select Fixture
                    </label>
                    <select
                      value={selectedFixtureIdx}
                      onChange={(e) => setSelectedFixtureIdx(Number(e.target.value))}
                      className="w-full bg-[#0a1128] border border-[#1e2d5a] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
                    >
                      {data.fixtures.map((f: any, i: number) => (
                        <option key={f.id} value={i}>
                          MD{f.matchday}: {f.home?.name} vs {f.away?.name} — {f.scheduled_date}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedFixture && (
                  <FixtureCard
                    homeTeam={selectedFixture.home}
                    awayTeam={selectedFixture.away}
                    tournament={data.name}
                    scheduledDate={selectedFixture.scheduled_date}
                    matchday={selectedFixture.matchday}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Result Graphic */}
        {activeTab === 'result' && (
          <div className="space-y-4">
            {data.results.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">No results yet.</div>
            ) : (
              <>
                {data.results.length > 1 && (
                  <div className="card p-4">
                    <label className="block text-xs font-semibold text-[#c9a84c] uppercase tracking-wider mb-2">
                      Select Result
                    </label>
                    <select
                      value={selectedResultIdx}
                      onChange={(e) => setSelectedResultIdx(Number(e.target.value))}
                      className="w-full bg-[#0a1128] border border-[#1e2d5a] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c]"
                    >
                      {data.results.map((r: any, i: number) => (
                        <option key={i} value={i}>
                          {r.home_team_name} {r.home_score}–{r.away_score} {r.away_team_name}
                          {r.is_abandoned ? ' (Abandoned)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedResult && (
                  <ResultGraphic
                    homeTeam={{
                      name: selectedResult.home_team_name ?? 'Home',
                      logo_league_folder: selectedResult.home_logo_league_folder ?? '',
                      logo_team_slug: selectedResult.home_logo_team_slug ?? '',
                    }}
                    awayTeam={{
                      name: selectedResult.away_team_name ?? 'Away',
                      logo_league_folder: selectedResult.away_logo_league_folder ?? '',
                      logo_team_slug: selectedResult.away_logo_team_slug ?? '',
                    }}
                    homeScore={selectedResult.home_score}
                    awayScore={selectedResult.away_score}
                    tournament={data.name}
                    date={selectedResult.date ?? new Date().toISOString()}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Group Table */}
        {activeTab === 'group_table' && (
          <div className="space-y-4">
            {Object.keys(data.groups).length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                No group stage data. This template is for UCL/Europa tournaments.
              </div>
            ) : (
              <GroupTableGraphic groups={data.groups} tournament={data.name} />
            )}
          </div>
        )}

        {/* Gameweek Summary */}
        {activeTab === 'gameweek' && (
          <GameweekSummary
            fixtures={data.fixtures}
            results={data.results}
            tournamentName={data.name}
          />
        )}
      </div>
    </div>
  )
}
