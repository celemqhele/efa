'use client'
import ManagersClient from './ManagersClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground-primary">Manage Managers</h1>
        <p className="text-text-muted text-sm mt-1">
          Assign or remove managers for each club in the league.
        </p>
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
