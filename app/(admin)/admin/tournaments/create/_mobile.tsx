import CreateTournamentClient from './CreateTournamentClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="bg-bg-elevated border border-border rounded-xl p-4">
        <h1 className="text-lg font-bold text-text-primary">Create Tournament</h1>
        <p className="text-text-muted text-xs mt-1">Set up a new season tournament.</p>
      </div>

      <CreateTournamentClient
        seasons={data.seasons}
        allTeams={data.allTeams}
      />
    </div>
  )
}
