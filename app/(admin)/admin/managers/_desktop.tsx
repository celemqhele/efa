'use client'
import ManagersClient from './ManagersClient'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Manage Managers</h1>
        <p className="text-sm text-text-muted mt-1">Assign or remove managers for each club in the league.</p>
      </div>
      <ManagersClient
        teams={data.teams}
        profiles={data.profiles}
        managedTeamByUser={data.managedTeamByUser}
        hasAvailabilityIds={data.hasAvailabilityIds}
      />
    </div>
  )
}
