import CreateTournamentClient from './CreateTournamentClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground-primary">Create Tournament</h1>
        <p className="text-text-muted text-sm mt-1">Set up a new season tournament.</p>
      </div>

      <CreateTournamentClient
        seasons={data.seasons}
        allTeams={data.allTeams}
      />
    </div>
  )
}
