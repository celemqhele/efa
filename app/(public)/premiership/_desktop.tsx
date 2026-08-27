'use client'

import TeamLogo from '@/components/ui/TeamLogo'

export interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

export interface League {
  folder: string
  name: string
  tier: string
  teams: Team[]
}

export default function Desktop({ leagues }: { leagues: League[] }) {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20">
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">South African Leagues</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary">South African Football Leagues</h1>
        <p className="text-sm text-text-muted max-w-2xl mx-auto">
          All three levels of South African football are now available for selection.
          Pick your team for the upcoming season.
        </p>
      </div>

      {leagues.map((league) => (
        <div
          key={league.folder}
          className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{league.name}</h2>
              <p className="text-xs text-text-muted mt-0.5">{league.tier}</p>
            </div>
            <span className="text-xs text-text-muted">{league.teams.length} teams</span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {league.teams.map((team) => (
              <div
                key={team.id}
                className="flex flex-col items-center gap-3 p-4 rounded-xl bg-bg-elevated/50 border border-border/50 hover:border-accent/30 transition-colors"
              >
                <div className="w-16 h-16">
                  <TeamLogo
                    leagueFolder={team.logo_league_folder}
                    teamSlug={team.logo_team_slug}
                    context="news_thumb"
                    alt={team.name}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-sm font-medium text-text-primary text-center leading-tight">
                  {team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center">
        <p className="text-xs text-text-muted">
          Teams are now available for selection via WhatsApp or admin assignment.
        </p>
      </div>
    </div>
  )
}
