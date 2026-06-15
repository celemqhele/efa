'use client'
import SeasonManager from './SeasonManager'

export default function Desktop({ data }: { data: any }) {
  return (
    <SeasonManager
      seasons={data.seasons}
      allTeams={data.allTeams}
      prevSeasonStandings={data.prevSeasonStandings}
    />
  )
}
