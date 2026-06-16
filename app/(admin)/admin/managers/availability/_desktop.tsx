'use client'
import AvailabilityManager from './AvailabilityManager'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Availability Schedule</h2>
        <p className="text-sm text-text-muted mt-1">Set your weekly availability for fixture scheduling.</p>
      </div>
      <AvailabilityManager
        managerId={data.managerId}
        initialSchedule={data.initialSchedule}
        initialType={data.initialType}
      />
    </div>
  )
}
