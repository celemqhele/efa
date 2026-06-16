'use client'
import SeasonManager from './SeasonManager'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SeasonManager
        seasons={data.seasons}
        allTeams={data.allTeams}
        prevSeasonStandings={data.prevSeasonStandings}
      />
    </div>
  )
}
