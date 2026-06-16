'use client'
import FixtureScheduler from './FixtureScheduler'

export default function Desktop({ data }: { data: any }) {
  const { tournamentId, unscheduledCount } = data
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Scheduling Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            <span className="font-semibold text-accent">{unscheduledCount}</span> unscheduled fixture{unscheduledCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <FixtureScheduler tournamentId={tournamentId} unscheduledCount={unscheduledCount} />
    </div>
  )
}
