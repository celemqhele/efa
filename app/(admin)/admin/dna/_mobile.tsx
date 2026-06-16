'use client'
import DNAProfilesView from './DNAProfilesView'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">DNA Profiles</h1>
          <p className="text-xs text-text-muted mt-0.5">View and edit team DNA profiles</p>
        </div>
      </div>
      <DNAProfilesView
        teams={data.teams}
        dnaMap={data.dnaMap}
      />
    </div>
  )
}
