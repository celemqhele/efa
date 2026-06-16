'use client'
import ManagersClient from './ManagersClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="bg-bg-elevated border border-border rounded-xl p-4 space-y-2">
        <h1 className="text-lg font-bold text-text-primary">Manage Managers</h1>
        <p className="text-xs text-text-muted">Assign or remove managers for each club in the league.</p>
        <div className="flex gap-4 pt-1 text-sm text-text-secondary">
          <span><span className="font-semibold text-text-primary">{data.teams?.length ?? 0}</span> teams</span>
          <span><span className="font-semibold text-text-primary">{data.profiles?.length ?? 0}</span> profiles</span>
        </div>
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
