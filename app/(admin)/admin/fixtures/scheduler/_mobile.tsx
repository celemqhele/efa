'use client'
import FixtureScheduler from './FixtureScheduler'

export default function Mobile({ data }: { data: any }) {
  const { tournamentId, unscheduledCount } = data
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scheduling Dashboard</h1>
      <FixtureScheduler tournamentId={tournamentId} unscheduledCount={unscheduledCount} />
    </div>
  )
}
