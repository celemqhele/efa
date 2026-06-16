'use client'
import SeasonManager from './SeasonManager'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="bg-bg-elevated border border-border rounded-xl p-4">
        <h2 className="text-base font-semibold text-text-primary">Season Manager</h2>
        <p className="text-xs text-text-muted mt-1">{data.seasons?.length ?? 0} season{(data.seasons?.length ?? 0) !== 1 ? 's' : ''} configured</p>
      </div>
      <SeasonManager
        seasons={data.seasons}
        allTeams={data.allTeams}
        prevSeasonStandings={data.prevSeasonStandings}
      />
    </div>
  )
}
