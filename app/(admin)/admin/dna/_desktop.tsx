'use client'
import DNAProfilesView from './DNAProfilesView'

export default function Desktop({ data }: { data: any }) {
  return (
    <DNAProfilesView
      teams={data.teams}
      dnaMap={data.dnaMap}
    />
  )
}
