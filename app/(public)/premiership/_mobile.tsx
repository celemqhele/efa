'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import type { League } from './_desktop'

export default function Mobile({ leagues }: { leagues: League[] }) {
  return (
    <div className="space-y-5 pb-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
          <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">New Leagues</span>
        </div>
        <h1 className="text-xl font-bold text-text-primary">South African Football Leagues</h1>
        <p className="text-xs text-text-muted px-4">
          All three levels of South African football are now available for selection.
        </p>
      </div>

      {leagues.map((league) => (
        <div
          key={league.folder}
          className="bg-bg-surface border border-border rounded-2xl p-4 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-text-primary">{league.name}</h2>
              <p className="text-[10px] text-text-muted mt-0.5">{league.tier}</p>
            </div>
            <span className="text-[10px] text-text-muted">{league.teams.length} teams</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {league.teams.map((team) => (
              <div
                key={team.id}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-elevated/50 border border-border/50"
              >
                <div className="w-12 h-12">
                  <TeamLogo
                    leagueFolder={team.logo_league_folder}
                    teamSlug={team.logo_team_slug}
                    context="news_thumb"
                    alt={team.name}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-[11px] font-medium text-text-primary text-center leading-tight">
                  {team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-center text-[10px] text-text-muted px-4">
        Teams available via WhatsApp or admin assignment.
      </p>
    </div>
  )
}
