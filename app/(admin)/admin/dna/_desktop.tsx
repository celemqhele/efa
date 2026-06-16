'use client'
import DNAProfilesView from './DNAProfilesView'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">DNA Profiles</h1>
        <p className="text-sm text-text-muted mt-1">View and edit team DNA profiles</p>
      </div>
      <DNAProfilesView
        teams={data.teams}
        dnaMap={data.dnaMap}
      />
    </div>
  )
}
