'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DaySchedule } from '@/lib/scheduling'

interface Props {
  managerId: string
  initialSchedule: DaySchedule[]
  initialType: 'EVERYDAY' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM'
}

export default function AvailabilityManager({ managerId, initialSchedule, initialType }: Props) {
  const [type, setType] = useState(initialType)
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialSchedule)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/admin/managers/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: managerId, profile_type: type, schedule }),
    })
    setSaving(false)
  }

  return (
    <Card className="p-space-6 space-y-space-4">
      <h2 className="text-lg font-bold">Manage Availability</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Profile</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input-field">
            <option value="EVERYDAY">Everyday</option>
            <option value="WEEKDAYS">Weekdays</option>
            <option value="WEEKENDS">Weekends</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {schedule.map((day, idx) => (
          <div key={day.day} className="flex items-center gap-4">
            <span className="w-16 font-medium">{day.day}</span>
            <input 
              type="checkbox" 
              checked={day.available} 
              onChange={(e) => {
                const ns = [...schedule]
                ns[idx].available = e.target.checked
                setSchedule(ns)
              }} 
            />
            <input 
              type="time" 
              value={day.start ?? ''} 
              onChange={(e) => {
                const ns = [...schedule]
                ns[idx].start = e.target.value
                setSchedule(ns)
              }} 
              disabled={!day.available}
              className="input-field w-32"
            />
            <input 
              type="time" 
              value={day.end ?? ''} 
              onChange={(e) => {
                const ns = [...schedule]
                ns[idx].end = e.target.value
                setSchedule(ns)
              }} 
              disabled={!day.available}
              className="input-field w-32"
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} isLoading={saving}>Save Availability</Button>
    </Card>
  )
}
