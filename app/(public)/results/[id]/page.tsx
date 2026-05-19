import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResultDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: result } = await supabase
    .from('results')
    .select(`
      *,
      match_stats (*),
      fixtures (
        id, matchday, scheduled_date, round_type, tournament_id,
        home_team:teams!home_team_id (
          id, name, logo_league_folder, logo_team_slug,
          manager:profiles!manager_id (username)
        ),
        away_team:teams!away_team_id (
          id, name, logo_league_folder, logo_team_slug,
          manager:profiles!manager_id (username)
        ),
        tournament:tournaments (name, type)
      )
    `)
    .eq('id', id)
    .single()

  if (!result) notFound()

  const fixture = result.fixtures as any
  const stats = result.match_stats as any
  const home = fixture?.home_team
  const away = fixture?.away_team
  const tournament = fixture?.tournament

  const tournamentColor =
    tournament?.type === 'league' ? 'text-[#c9a84c]' :
    tournament?.type === 'ucl' ? 'text-blue-400' :
    tournament?.type === 'europa' ? 'text-orange-400' :
    'text-purple-400'

  function StatBar({ label, homeVal, awayVal }: { label: string; homeVal: number; awayVal: number }) {
    const total = homeVal + awayVal || 1
    const homePct = Math.round((homeVal / total) * 100)
    const awayPct = 100 - homePct
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-900">{homeVal}</span>
          <span>{label}</span>
          <span className="font-semibold text-slate-900">{awayVal}</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-200">
          <div className="bg-[#c9a84c] transition-all" style={{ width: `${homePct}%` }} />
          <div className="bg-blue-500 transition-all" style={{ width: `${awayPct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Back */}
      <Link href="/results" className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
        ← Results
      </Link>

      {/* Score card */}
      <div className="card p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.06),transparent_70%)]" />
        <div className="relative">
          {/* Tournament + matchday */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className={`text-xs font-bold uppercase tracking-widest ${tournamentColor}`}>
              {tournament?.name}
            </span>
            {fixture?.matchday && (
              <span className="text-xs text-slate-600">· Matchday {fixture.matchday}</span>
            )}
          </div>

          {result.is_abandoned && (
            <div className="mb-4 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium inline-block">
              ⚠️ Abandoned ({result.abandoned_type === 'both' ? 'Mutual' : `${result.abandoned_type} team`})
            </div>
          )}

          {/* Teams + score */}
          <div className="flex items-center justify-between gap-4">
            {/* Home */}
            <Link href={`/teams/${home?.id}`} className="flex flex-col items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
              {home?.logo_league_folder && (
                <Image
                  src={getTeamLogo(home.logo_league_folder, home.logo_team_slug, 'match_detail_hero')}
                  alt={home.name}
                  width={80} height={80}
                  className="object-contain"
                />
              )}
              <span className="text-sm font-bold text-slate-900 text-center leading-tight">{home?.name}</span>
              <span className="text-xs text-slate-500">{home?.manager?.username ?? 'NO MANAGER'}</span>
            </Link>

            {/* Score */}
            <div className="text-center">
              <div className="text-5xl font-black text-slate-900 tabular-nums">
                {result.home_score}
                <span className="text-slate-400 mx-2">–</span>
                {result.away_score}
              </div>
              {fixture?.scheduled_date && (
                <div className="text-xs text-slate-500 mt-2">
                  {format(parseISO(fixture.scheduled_date), 'EEE d MMM yyyy')}
                </div>
              )}
              <div className="text-xs text-green-400 mt-1 font-medium">Full Time</div>
            </div>

            {/* Away */}
            <Link href={`/teams/${away?.id}`} className="flex flex-col items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
              {away?.logo_league_folder && (
                <Image
                  src={getTeamLogo(away.logo_league_folder, away.logo_team_slug, 'match_detail_hero')}
                  alt={away.name}
                  width={80} height={80}
                  className="object-contain"
                />
              )}
              <span className="text-sm font-bold text-slate-900 text-center leading-tight">{away?.name}</span>
              <span className="text-xs text-slate-500">{away?.manager?.username ?? 'NO MANAGER'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Match Stats */}
      {stats && (
        <div className="card p-4">
          <h2 className="section-header text-base">Match Statistics</h2>
          <div className="space-y-3">
            {stats.home_possession != null && (
              <StatBar label="Possession %" homeVal={stats.home_possession} awayVal={stats.away_possession ?? 0} />
            )}
            {stats.home_shots != null && (
              <StatBar label="Shots" homeVal={stats.home_shots} awayVal={stats.away_shots ?? 0} />
            )}
            {stats.home_shots_on_target != null && (
              <StatBar label="Shots on Target" homeVal={stats.home_shots_on_target} awayVal={stats.away_shots_on_target ?? 0} />
            )}
            {stats.home_passes != null && (
              <StatBar label="Passes" homeVal={stats.home_passes} awayVal={stats.away_passes ?? 0} />
            )}
            {stats.home_successful_passes != null && (
              <StatBar label="Successful Passes" homeVal={stats.home_successful_passes} awayVal={stats.away_successful_passes ?? 0} />
            )}
            {stats.home_corners != null && (
              <StatBar label="Corners" homeVal={stats.home_corners} awayVal={stats.away_corners ?? 0} />
            )}
            {stats.home_fouls != null && (
              <StatBar label="Fouls" homeVal={stats.home_fouls} awayVal={stats.away_fouls ?? 0} />
            )}
            {stats.home_tackles != null && (
              <StatBar label="Tackles" homeVal={stats.home_tackles} awayVal={stats.away_tackles ?? 0} />
            )}
            {stats.home_saves != null && (
              <StatBar label="Saves" homeVal={stats.home_saves} awayVal={stats.away_saves ?? 0} />
            )}
            {stats.home_interceptions != null && (
              <StatBar label="Interceptions" homeVal={stats.home_interceptions} awayVal={stats.away_interceptions ?? 0} />
            )}
          </div>

          {/* Key: home=gold, away=blue */}
          <div className="flex justify-between mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-[#c9a84c]" />
              <span className="text-xs text-slate-400">{home?.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{away?.name}</span>
              <div className="w-3 h-1.5 rounded-full bg-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Screenshot */}
      {result.screenshot_url && (
        <div className="card p-4">
          <h2 className="section-header text-base">Match Screenshot</h2>
          <img
            src={result.screenshot_url}
            alt="Match screenshot"
            className="w-full rounded-lg border border-slate-200"
          />
        </div>
      )}

      {/* View fixture */}
      {fixture?.id && (
        <Link
          href={`/fixtures/${fixture.id}`}
          className="btn-outline w-full text-center py-3 block text-sm"
        >
          View Fixture Details →
        </Link>
      )}
    </div>
  )
}
