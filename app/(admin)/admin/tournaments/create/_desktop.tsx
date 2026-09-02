import CreateTournamentClient from './CreateTournamentClient'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Create Tournament</h1>
        <p className="text-text-muted text-sm mt-1">Set up a new season tournament.</p>
      </div>

      <CreateTournamentClient
        seasons={data.seasons}
        users={data.users}
      />
    </div>
  )
}
