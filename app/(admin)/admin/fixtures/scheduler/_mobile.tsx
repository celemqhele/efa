'use client'
import FixtureScheduler from './FixtureScheduler'

export default function Mobile({ data }: { data: any }) {
  const { tournamentId, unscheduledCount } = data
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="bg-bg-elevated border border-border rounded-xl p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Scheduling Dashboard</h1>
          <p className="text-xs text-text-muted">Unscheduled: {unscheduledCount}</p>
        </div>
        <span className="text-2xl font-black text-accent">{unscheduledCount}</span>
      </div>
      <FixtureScheduler tournamentId={tournamentId} unscheduledCount={unscheduledCount} />
    </div>
  )
}
