'use client'
import { useState } from 'react'
import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { Card } from '@/components/ui/Card'

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-text-muted/20 text-text-muted border-text-muted/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-feedback-warning/20 text-feedback-warning border-feedback-warning/30' },
  confirmed: { label: 'FT', pill: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30' },
  completed: { label: 'FT', pill: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-feedback-error/20 text-feedback-error border-feedback-error/30' },
}

const TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  tournament_club: 'Tournament',
  tournament_international: 'Intl',
  friendlies: 'Friendly',
}

const TYPE_ACCENT: Record<string, string> = {
  league: 'text-accent border-accent/40 bg-accent/5',
  tournament_club: 'text-blue-500 border-blue-500/40 bg-blue-500/5',
  tournament_international: 'text-orange-500 border-orange-500/40 bg-orange-500/5',
  friendlies: 'text-purple-500 border-purple-500/40 bg-purple-500/5',
}

function formatWhen(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = new Date(dateStr)
    const datePart = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    })
    return `${datePart} · ${timePart}`
  } catch {
    return dateStr
  }
}

function FixtureCard({ f, siblingIds, resultsByFixture }: { f: any; siblingIds: string[]; resultsByFixture: Record<string, any> }) {
  const homeTeam = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
  const awayTeam = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team

  const isHome = homeTeam ? siblingIds.includes(homeTeam.id) : siblingIds.includes(f.home_team_id)
  const opponent = isHome ? awayTeam : homeTeam

  const result = resultsByFixture[f.id]

  const myScore = isHome ? result?.home_score : result?.away_score
  const oppScore = isHome ? result?.away_score : result?.home_score

  const hasResult = result != null && myScore != null && oppScore != null
  const won = hasResult && myScore > oppScore
  const lost = hasResult && myScore < oppScore
  const drew = hasResult && myScore === oppScore

  const tournament = f.tournament
  const tournamentType = tournament?.type ?? 'unknown'
  const tournamentLabel = TYPE_LABELS[tournamentType] ?? tournament?.name ?? '—'
  const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

  let resultBadge: React.ReactNode = null
  if (won) {
    resultBadge = <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-feedback-success/20 text-feedback-success border border-feedback-success/30">W</span>
  } else if (lost) {
    resultBadge = <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-feedback-error/20 text-feedback-error border border-feedback-error/30">L</span>
  } else if (drew) {
    resultBadge = <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-text-muted/20 text-text-muted border border-text-muted/30">D</span>
  }

  return (
    <Link
      href={result ? `/results/${result.id}` : `/fixtures/${f.id}`}
      className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-bg-surface hover:border-accent/30 hover:bg-black/[0.03] transition-all"
    >
      {opponent?.logo_league_folder ? (
        <TeamLogo
          leagueFolder={opponent.logo_league_folder}
          teamSlug={opponent.logo_team_slug}
          context="standings_row"
          alt={opponent.name}
          className="w-10 h-10 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-bg-base shrink-0 flex items-center justify-center text-[10px] text-text-muted">?</div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${TYPE_ACCENT[tournamentType] ?? 'text-text-muted border-border'}`}>
            {tournamentLabel}
          </span>
          <span className="text-[9px] text-text-muted font-mono">{isHome ? 'vs' : '@'}</span>
        </div>
        <p className="text-sm font-semibold text-text-primary truncate mt-0.5">{opponent?.name ?? 'TBC'}</p>
        <p className="text-[10px] text-text-muted mt-0.5">{formatWhen(f.scheduled_date)}</p>
      </div>

      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {result ? (
          <span className="text-base font-black text-text-primary tabular-nums">
            {myScore}–{oppScore}
          </span>
        ) : (
          <span className={`text-[9px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
            {statusInfo.label}
          </span>
        )}
        {resultBadge}
      </div>
    </Link>
  )
}

export default function Mobile({ data }: { data: any }) {
  const { team, siblingIds, upcoming, past, resultsByFixture } = data
  const [tab, setTab] = useState<'upcoming' | 'results'>('upcoming')

  return (
    <div className="px-4 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/teams/${team.id}`}
          className="w-10 h-10 rounded-lg flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors shrink-0"
        >
          ‹
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          {team.logo_league_folder && (
            <TeamLogo
              leagueFolder={team.logo_league_folder}
              teamSlug={team.logo_team_slug}
              context="standings_row"
              alt={team.name}
              className="w-10 h-10 shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">Fixtures & Results</h1>
            <p className="text-xs text-accent font-medium truncate">{team.name}</p>
          </div>
        </div>
      </div>

      {/* Filter pills — horizontal scroll */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-none">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setTab('upcoming')}
            className={`min-h-[40px] px-4 rounded-full border text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === 'upcoming'
                ? 'bg-accent text-white border-accent'
                : 'bg-bg-surface text-text-muted border-border hover:border-accent/50'
            }`}
          >
            Upcoming{upcoming.length > 0 && <span className="ml-1.5 text-[9px] opacity-70">({upcoming.length})</span>}
          </button>
          <button
            onClick={() => setTab('results')}
            className={`min-h-[40px] px-4 rounded-full border text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === 'results'
                ? 'bg-accent text-white border-accent'
                : 'bg-bg-surface text-text-muted border-border hover:border-accent/50'
            }`}
          >
            Results{past.length > 0 && <span className="ml-1.5 text-[9px] opacity-70">({past.length})</span>}
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'upcoming' ? (
        <section className="space-y-3">
          {upcoming.length === 0 ? (
            <Card className="p-8 text-center text-sm text-text-muted">No upcoming fixtures scheduled.</Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((f: any) => <FixtureCard key={f.id} f={f} siblingIds={siblingIds} resultsByFixture={resultsByFixture} />)}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {past.length === 0 ? (
            <Card className="p-8 text-center text-sm text-text-muted">No past results on record.</Card>
          ) : (
            <div className="space-y-2">
              {past.map((f: any) => <FixtureCard key={f.id} f={f} siblingIds={siblingIds} resultsByFixture={resultsByFixture} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
