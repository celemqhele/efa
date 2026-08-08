'use client'
import BackdoorSubmissionsClient from './BackdoorSubmissionsClient'

export default function Shell({ data }: { data: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Backdoor Submissions</h1>
        <p className="text-text-muted text-sm mt-1">
          Review and manage backdoor win applications.
        </p>
      </div>
      <BackdoorSubmissionsClient groupedSubmissions={data.groupedSubmissions} />
    </div>
  )
}