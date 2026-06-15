'use client'
import SeasonManager from './SeasonManager'

export default function Mobile({ data }: { data: any }) {
  return (
    <SeasonManager
      seasons={data.seasons}
      allTeams={data.allTeams}
      prevSeasonStandings={data.prevSeasonStandings}
    />
  )
}
