'use client'
import DNAProfilesView from './DNAProfilesView'

export default function Mobile({ data }: { data: any }) {
  return (
    <DNAProfilesView
      teams={data.teams}
      dnaMap={data.dnaMap}
    />
  )
}
