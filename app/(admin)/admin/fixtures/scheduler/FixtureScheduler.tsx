'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function FixtureScheduler({ tournamentId, unscheduledCount }: { tournamentId: string, unscheduledCount: number }) {
  const [loading, setLoading] = useState(false)
  const [scheduledCount, setScheduledCount] = useState<number | null>(null)

  async function handleSchedule() {
    setLoading(true)
    const res = await fetch('/api/admin/schedule-fixtures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tournamentId, 
        startDate: new Date().toISOString().slice(0, 10) 
      })
    })
    const data = await res.json()
    setScheduledCount(data.count)
    setLoading(false)
  }

  return (
    <Card className="p-space-6 space-y-space-4">
      <h2 className="text-lg font-bold">Schedule Fixtures</h2>
      <p className="text-sm text-text-muted">{unscheduledCount} fixtures are awaiting scheduling.</p>
      
      <Button onClick={handleSchedule} isLoading={loading} disabled={unscheduledCount === 0}>
        {scheduledCount !== null ? `Successfully scheduled ${scheduledCount} fixtures` : 'Run Scheduling Algorithm'}
      </Button>
    </Card>
  )
}
