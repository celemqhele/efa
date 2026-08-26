'use client'

import TeamLogo, { TBCBadge } from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, Crosshair, CalendarDays } from 'lucide-react'

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'bg-accent/10 text-accent border-accent/25' },
  ucl: { label: 'UCL', colour: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  europa: { label: 'EL', colour: 'bg-orange-500/10 text-orange-400 border-orange-500/25' },
  super_cup: { label: 'SC', colour: 'bg-purple-500/10 text-purple-400 border-purple-500/25' },
}

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return parseISO(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return null
  }
}

function formatDateGroup(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const today = new Date()
    const todayKey = today.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = tomorrow.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })
    const dateKey = d.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })

    if (dateKey === todayKey) return 'Today'
    if (dateKey === tomorrowKey) return 'Tomorrow'

    return d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return dateStr
  }
}

function FixtureCard({ f, teamIds }: { f: any; teamIds: string[] }) {
  const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
  const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team

  const isHome = teamIds.includes(home?.id)
  const opponent = isHome ? away : home
  const result = f._result
  const myScore = isHome ? result?.home_score : result?.away_score
  const oppScore = isHome ? result?.away_score : result?.home_score
  const won = result != null && myScore != null && oppScore != null && myScore > oppScore
  const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
  const drew = result != null && myScore != null && oppScore != null && myScore === oppScore
  const time = formatTime(f.scheduled_date)

  let resultBadge: { label: string; cls: string } | null = null
  if (won) resultBadge = { label: 'W', cls: 'bg-green-500/15 text-green-500 border-green-500/30' }
  else if (lost) resultBadge = { label: 'L', cls: 'bg-red-500/15 text-red-500 border-red-500/30' }
  else if (drew) resultBadge = { label: 'D', cls: 'bg-slate-500/15 text-text-muted border-slate-500/30' }

  const borderAccent = won ? 'border-l-green-500/40' : lost ? 'border-l-red-500/40' : 'border-l-slate-500/20'

  return (
    <Link
      href={`/fixtures/${f.id}`}
      className={`flex items-center gap-3 px-4 py-3.5 min-h-[60px] bg-bg-surface border border-border rounded-xl border-l-4 ${borderAccent} active:bg-accent/5 transition-colors`}
    >
      {opponent ? (
        <TeamLogo
          leagueFolder={opponent.logo_league_folder}
          teamSlug={opponent.logo_team_slug}
          context="fixture_card"
          alt={opponent.name}
          className="w-10 h-10 shrink-0"
        />
      ) : (
        <TBCBadge className="w-10 h-10 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate mb-0.5">
          {opponent?.name ?? 'TBC'}
        </p>
        <p className="text-[10px] text-text-muted">
          {time ?? <span className="italic">No time set</span>}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {result ? (
          <>
            <span className="text-xl font-black text-text-primary tabular-nums leading-none">
              {myScore}–{oppScore}
            </span>
            {resultBadge && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${resultBadge.cls}`}>
                {resultBadge.label}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-accent leading-none">{time ?? 'vs'}</span>
            <span className="text-[9px] text-text-muted font-medium">Upcoming</span>
          </>
        )}
      </div>
    </Link>
  )
}

interface MobileProps {
  data: {
    user: any
    teams: any[]
    teamIds: string[]
    fixturesWithResults: any[]
    upcoming: any[]
    grouped: Record<string, any[]>
    sortedKeys: string[]
    primaryTeam: any
  }
}

export default function Mobile({ data }: MobileProps) {
  const { user, teamIds, upcoming, grouped, sortedKeys, primaryTeam } = data
  const pathname = usePathname()

  if (!user) {
    return (
      <div className="px-4 pb-8 space-y-5">
        <h1 className="text-base font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-10 text-center space-y-4">
          <Trophy className="w-10 h-10 text-text-muted mx-auto" />
          <div>
            <p className="text-text-muted text-sm font-medium">Log in to see your team&apos;s fixtures.</p>
          </div>
          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="btn-gold inline-block text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="px-4 pb-8 space-y-5">
        <h1 className="text-base font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-10 text-center space-y-4">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm font-medium">You don&apos;t have a team yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        {primaryTeam?.logo_league_folder && (
          <TeamLogo
            leagueFolder={primaryTeam.logo_league_folder}
            teamSlug={primaryTeam.logo_team_slug}
            context="fixture_card"
            alt={primaryTeam.name}
            className="w-8 h-8 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-text-primary">My Fixtures</h1>
          {primaryTeam && (
            <p className="text-[10px] text-accent font-medium truncate">{primaryTeam.name}</p>
          )}
        </div>
        <Link href="/results" className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors shrink-0">Results →</Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center">
          <CalendarDays className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted font-medium">No upcoming fixtures.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((dateKey) => {
            const fixturesInGroup = grouped[dateKey]!
            const firstFixture = fixturesInGroup[0]!
            const t = Array.isArray(firstFixture.tournament) ? firstFixture.tournament[0] : firstFixture.tournament
            const tournamentType = t?.type ?? 'unknown'
            const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }

            return (
              <section key={dateKey}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">{formatDateGroup(dateKey)}</h2>
                  <span className={`ml-1 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${typeStyle.colour}`}>
                    {typeStyle.label}
                  </span>
                  {firstFixture.matchday && (
                    <span className="text-[9px] text-text-muted font-semibold">MD{firstFixture.matchday}</span>
                  )}
                  <span className="text-[10px] text-text-muted font-medium ml-auto">({fixturesInGroup.length})</span>
                </div>
                <div className="space-y-2.5">
                  {fixturesInGroup.map((f: any) => (
                    <FixtureCard key={f.id} f={f} teamIds={teamIds} />
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
