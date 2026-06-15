'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, Crosshair, CalendarDays, ChevronRight } from 'lucide-react'

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'bg-accent/10 text-accent border-accent/25' },
  ucl: { label: 'UCL', colour: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  europa: { label: 'EL', colour: 'bg-orange-500/10 text-orange-400 border-orange-500/25' },
  super_cup: { label: 'SC', colour: 'bg-purple-500/10 text-purple-400 border-purple-500/25' },
}

function formatWhen(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const datePart = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      timeZone: APP_TIME_ZONE,
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
    return `${datePart} · ${timePart}`
  } catch {
    return dateStr
  }
}

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return parseISO(dateStr).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return dateStr
  }
}

function ResultCard({ f, teamIds }: { f: any; teamIds: string[] }) {
  const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
  const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
  const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
  const result = f._result

  const isHome = teamIds.includes(home?.id)
  const opponent = isHome ? away : home
  const myScore = isHome ? result?.home_score : result?.away_score
  const oppScore = isHome ? result?.away_score : result?.home_score
  const won = result != null && myScore != null && oppScore != null && myScore > oppScore
  const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
  const drew = result != null && myScore != null && oppScore != null && myScore === oppScore

  const tournamentType = t?.type ?? 'unknown'
  const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }

  let resultBadge: { label: string; cls: string } | null = null
  if (won) resultBadge = { label: 'W', cls: 'bg-green-500/15 text-green-500 border-green-500/30' }
  else if (lost) resultBadge = { label: 'L', cls: 'bg-red-500/15 text-red-500 border-red-500/30' }
  else if (drew) resultBadge = { label: 'D', cls: 'bg-slate-500/15 text-text-muted border-slate-500/30' }

  const borderAccent = won ? 'border-l-green-500/40' : lost ? 'border-l-red-500/40' : 'border-l-slate-500/20'

  return (
    <Link
      href={`/fixtures/${f.id}`}
      className={`card flex items-center gap-3 border-l-4 ${borderAccent} active:scale-[0.98] transition-transform`}
    >
      {opponent?.logo_league_folder && (
        <TeamLogo
          leagueFolder={opponent.logo_league_folder}
          teamSlug={opponent.logo_team_slug}
          context="fixture_card"
          alt={opponent.name}
          className="w-10 h-10 shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${typeStyle.colour}`}>
            {typeStyle.label}
          </span>
          <span className="text-[10px] text-text-muted font-semibold">MD{f.matchday}</span>
        </div>
        <p className="text-sm font-semibold text-foreground-primary truncate">
          {opponent?.name ?? 'TBC'}
        </p>
        <p className="text-[10px] text-text-muted mt-0.5">{formatWhen(f.scheduled_date)}</p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {result ? (
          <>
            <span className="text-xl font-black text-foreground-primary tabular-nums leading-none">
              {myScore}–{oppScore}
            </span>
            {resultBadge && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${resultBadge.cls}`}>
                {resultBadge.label}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-text-muted italic">No score</span>
        )}
      </div>
    </Link>
  )
}

interface DesktopProps {
  data: {
    user: any
    teams: any[]
    teamIds: string[]
    fixturesWithResults: any[]
    grouped: Record<string, any[]>
    sortedKeys: string[]
    primaryTeam: any
    wins: number
    draws: number
    losses: number
  }
}

export default function Desktop({ data }: DesktopProps) {
  const { user, teams, teamIds, fixturesWithResults, grouped, sortedKeys, primaryTeam, wins, draws, losses } = data

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground-primary">My Results</h1>
        <div className="card p-10 text-center space-y-3">
          <Trophy className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">Log in to see your team&apos;s past results.</p>
          <Link href="/login" className="btn-gold inline-block text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground-primary">My Results</h1>
        <div className="card p-10 text-center space-y-3">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">You don&apos;t have a team yet.</p>
          <Link href="/select-team" className="btn-gold inline-block text-sm">Pick a team</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {primaryTeam?.logo_league_folder && (
          <TeamLogo
            leagueFolder={primaryTeam.logo_league_folder}
            teamSlug={primaryTeam.logo_team_slug}
            context="fixture_card"
            alt={primaryTeam.name}
            className="w-10 h-10"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground-primary">My Results</h1>
          {primaryTeam && (
            <p className="text-xs text-accent truncate">{primaryTeam.name}</p>
          )}
        </div>
        <Link href="/fixtures" className="text-xs font-semibold text-accent shrink-0">
          Upcoming →
        </Link>
      </div>

      {(fixturesWithResults?.length ?? 0) > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card flex flex-col items-center py-3 gap-0.5 border-l-4 border-l-green-500/40">
            <span className="text-xl font-black text-green-500 leading-none">{wins}</span>
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Won</span>
          </div>
          <div className="card flex flex-col items-center py-3 gap-0.5 border-l-4 border-l-slate-500/20">
            <span className="text-xl font-black text-text-muted leading-none">{draws}</span>
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Drawn</span>
          </div>
          <div className="card flex flex-col items-center py-3 gap-0.5 border-l-4 border-l-red-500/40">
            <span className="text-xl font-black text-red-500 leading-none">{losses}</span>
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Lost</span>
          </div>
        </div>
      )}

      {fixturesWithResults.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-muted">
          <CalendarDays className="w-8 h-8 text-text-muted mx-auto mb-2" />
          No results yet.
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((monthKey) => {
            const fixturesInGroup = grouped[monthKey]!
            return (
              <section key={monthKey}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <div className="w-1 h-4 rounded-full bg-accent" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">
                    {formatMonth(fixturesInGroup[0]?.scheduled_date)}
                  </h2>
                  <span className="text-[10px] text-text-muted">({fixturesInGroup.length})</span>
                </div>
                <div className="space-y-2">
                  {fixturesInGroup.map((f: any) => (
                    <ResultCard key={f.id} f={f} teamIds={teamIds} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
