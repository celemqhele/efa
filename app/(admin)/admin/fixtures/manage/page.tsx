import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import FixtureActions from './FixtureActions'
import GenerateFixturesButton from './GenerateFixturesButton'

export const revalidate = 0

const STATUS_COLOURS: Record<string, string> = {
  scheduled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  awaiting_confirmation: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  postponed: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  abandoned: 'text-red-400 bg-red-500/10 border-red-500/20',
}

export default async function FixturesManagePage({
  searchParams,
}: {
  searchParams: { tournament?: string }
}) {
  const supabase = await createClient()

  // All tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .order('created_at', { ascending: false })

  const activeTournamentId = searchParams.tournament ?? tournaments?.[0]?.id ?? ''

  // Fixtures for selected tournament
  const { data: fixtures } = activeTournamentId
    ? await supabase
        .from('fixtures')
        .select(`
          id, matchday, round_type, scheduled_date, status, is_postponed, leg,
          home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
          result:results(home_score, away_score)
        `)
        .eq('tournament_id', activeTournamentId)
        .order('matchday', { ascending: true })
        .order('scheduled_date', { ascending: true })
    : { data: [] }

  const activeTournament = tournaments?.find((t) => t.id === activeTournamentId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fixture Management</h1>
          <p className="text-slate-400 text-sm mt-1">{fixtures?.length ?? 0} fixtures in selected tournament</p>
        </div>
        {activeTournamentId && (
          <GenerateFixturesButton tournamentId={activeTournamentId} tournamentName={activeTournament?.name ?? ''} />
        )}
      </div>

      {/* Tournament Tabs */}
      <div className="flex flex-wrap gap-2">
        {(tournaments ?? []).map((t) => (
          <a
            key={t.id}
            href={`?tournament=${t.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              t.id === activeTournamentId
                ? 'bg-gold text-navy border-gold'
                : 'bg-navy-light text-slate-300 border-navy-border hover:border-gold/30'
            }`}
          >
            {t.name}
            <span className={`ml-2 text-xs ${t.id === activeTournamentId ? 'text-navy/70' : 'text-slate-500'}`}>
              {t.type}
            </span>
          </a>
        ))}
      </div>

      {/* Fixtures Table */}
      {(fixtures?.length ?? 0) === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <p className="text-4xl mb-3">📅</p>
          <p>No fixtures found for this tournament.</p>
          {activeTournamentId && (
            <div className="mt-4">
              <GenerateFixturesButton tournamentId={activeTournamentId} tournamentName={activeTournament?.name ?? ''} />
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-border bg-navy-light/50">
                  <th className="text-left text-xs text-slate-500 py-3 px-4">MD</th>
                  <th className="text-left text-xs text-slate-500 py-3 px-4">Home</th>
                  <th className="text-center text-xs text-slate-500 py-3 px-2">Score</th>
                  <th className="text-left text-xs text-slate-500 py-3 px-4">Away</th>
                  <th className="text-left text-xs text-slate-500 py-3 px-4">Date</th>
                  <th className="text-left text-xs text-slate-500 py-3 px-4">Status</th>
                  <th className="text-left text-xs text-slate-500 py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border">
                {(fixtures ?? []).map((fx: any) => {
                  const result = fx.result?.[0]
                  const statusCls = STATUS_COLOURS[fx.status] ?? STATUS_COLOURS.scheduled
                  return (
                    <tr key={fx.id} className="hover:bg-navy-light/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-center">
                          <span className="text-white font-bold">{fx.matchday}</span>
                          {fx.leg > 1 && <span className="text-slate-500 text-xs block">Leg {fx.leg}</span>}
                          {fx.round_type !== 'league' && (
                            <span className="text-slate-500 text-xs block uppercase">{fx.round_type}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {fx.home_team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')}
                              alt={fx.home_team.name}
                              width={28} height={28}
                              className="object-contain shrink-0"
                            />
                          )}
                          <span className="text-white font-medium">{fx.home_team?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {result ? (
                          <span className="text-white font-bold text-base">
                            {result.home_score} – {result.away_score}
                          </span>
                        ) : (
                          <span className="text-slate-600">vs</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {fx.away_team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')}
                              alt={fx.away_team.name}
                              width={28} height={28}
                              className="object-contain shrink-0"
                            />
                          )}
                          <span className="text-white font-medium">{fx.away_team?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {fx.scheduled_date ? (
                          <div>
                            <p className="text-slate-300 text-xs">
                              {new Date(fx.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-slate-500 text-xs">
                              {new Date(fx.scheduled_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs italic">TBD</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded border ${statusCls}`}>
                          {fx.status.replace(/_/g, ' ')}
                        </span>
                        {fx.is_postponed && (
                          <span className="text-orange-400 text-xs ml-1">P</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <FixtureActions
                          fixtureId={fx.id}
                          currentDate={fx.scheduled_date}
                          status={fx.status}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
