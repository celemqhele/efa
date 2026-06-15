'use client'
import ManagersClient from './ManagersClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-3 pb-6 space-y-4">
      <h1 className="text-lg font-bold text-text-primary">Manage Managers</h1>
      <p className="text-xs text-text-muted">Assign or remove managers for each club in the league.</p>
      <ManagersClient
        teams={data.teams}
        profiles={data.profiles}
        managedTeamByUser={data.managedTeamByUser}
        hasAvailabilityIds={data.hasAvailabilityIds}
      />
    </div>
  )
}
