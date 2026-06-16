'use client'
import AvailabilityManager from './AvailabilityManager'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="bg-bg-elevated border border-border rounded-xl p-4">
        <h2 className="text-base font-semibold text-text-primary">Availability Schedule</h2>
        <p className="text-xs text-text-muted mt-1">Set your weekly availability for fixture scheduling.</p>
      </div>
      <AvailabilityManager
        managerId={data.managerId}
        initialSchedule={data.initialSchedule}
        initialType={data.initialType}
      />
    </div>
  )
}
