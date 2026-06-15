'use client'
import AvailabilityManager from './AvailabilityManager'

export default function Mobile({ data }: { data: any }) {
  return (
    <AvailabilityManager
      managerId={data.managerId}
      initialSchedule={data.initialSchedule}
      initialType={data.initialType}
    />
  )
}
