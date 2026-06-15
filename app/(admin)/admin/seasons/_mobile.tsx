'use client'
import SeasonManager from './SeasonManager'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-3 pb-6">
      <SeasonManager
        seasons={data.seasons}
        allTeams={data.allTeams}
        prevSeasonStandings={data.prevSeasonStandings}
      />
    </div>
  )
}
