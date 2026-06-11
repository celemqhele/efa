'use client'

import { useState, useMemo } from 'react'
import type { DaySchedule } from '@/lib/scheduling'

interface Props {
  managerId: string
  initialSchedule: DaySchedule[]
  initialType: 'EVERYDAY' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM'
}

type ProfileType = 'EVERYDAY' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM'

interface Entry {
  id: string
  start: string
  end: string
  days: string[]
}

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

const PROFILE_DAYS: Record<Exclude<ProfileType, 'CUSTOM'>, string[]> = {
  EVERYDAY: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  WEEKDAYS: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  WEEKENDS: ['SAT', 'SUN'],
}

const DAY_LABELS: Record<string, string> = {
  MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu',
  FRI: 'Fri', SAT: 'Sat', SUN: 'Sun',
}

let entryId = 0

function scheduleToEntries(schedule: DaySchedule[]): Entry[] {
  const groups: Record<string, string[]> = {}
  const times: Record<string, { start: string; end: string }> = {}
  for (const day of schedule) {
    if (!day.available || !day.start || !day.end) continue
    const key = day.start + '|' + day.end
    if (!groups[key]) { groups[key] = []; times[key] = { start: day.start, end: day.end } }
    groups[key].push(day.day)
  }
  return Object.entries(groups).map(([k, days]) => ({
    id: String(entryId++),
    start: times[k].start,
    end: times[k].end,
    days,
  }))
}

function entriesToSchedule(entries: Entry[]): DaySchedule[] {
  const occupied = new Map<string, { start: string; end: string }>()
  for (const e of entries) {
    for (const d of e.days) {
      occupied.set(d, { start: e.start, end: e.end })
    }
  }
  return ALL_DAYS.map((day) => {
    const slot = occupied.get(day)
    return {
      day,
      available: slot !== undefined,
      start: slot?.start ?? null,
      end: slot?.end ?? null,
    }
  })
}

export default function AvailabilityManager({ managerId, initialSchedule, initialType }: Props) {
  const [type, setType] = useState<ProfileType>(initialType)
  const [entries, setEntries] = useState<Entry[]>(() => {
    const fromSchedule = scheduleToEntries(initialSchedule)
    if (fromSchedule.length > 0) return fromSchedule
    const presetDays = PROFILE_DAYS[initialType as Exclude<ProfileType, 'CUSTOM'>]
    if (presetDays && !initialType.startsWith('CUSTOM')) {
      return [{ id: String(entryId++), start: '18:00', end: '23:00', days: [...presetDays] }]
    }
    return []
  })

  const [newStart, setNewStart] = useState('18:00')
  const [newEnd, setNewEnd] = useState('23:00')
  const [newDays, setNewDays] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const coveredDays = useMemo(() => new Set(entries.flatMap((e) => e.days)), [entries])

  function handleProfileChange(newType: ProfileType) {
    setType(newType)
    setMessage(null)
    if (newType === 'CUSTOM') return
    const days = PROFILE_DAYS[newType as Exclude<ProfileType, 'CUSTOM'>]
    if (days) {
      setEntries([{ id: String(entryId++), start: '18:00', end: '23:00', days: [...days] }])
    }
  }

  function handleAdd() {
    if (!newStart || !newEnd || newDays.length === 0) return
    setEntries((prev) => [...prev, { id: String(entryId++), start: newStart, end: newEnd, days: [...newDays] }])
    setNewDays([])
  }

  function handleRemove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function toggleNewDay(day: string) {
    setNewDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const schedule = entriesToSchedule(entries)
      const res = await fetch('/api/admin/managers/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: managerId, profile_type: type, schedule }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      setMessage({ ok: true, text: 'Availability saved successfully' })
    } catch (err: any) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 space-y-5">
      <h2 className="text-lg font-bold text-foreground-primary">Manage Availability</h2>

      {/* Profile selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Quick Profile</label>
          <select
            value={type}
            onChange={(e) => handleProfileChange(e.target.value as ProfileType)}
            className="input-field"
          >
            <option value="EVERYDAY">Everyday</option>
            <option value="WEEKDAYS">Weekdays (Mon–Fri)</option>
            <option value="WEEKENDS">Weekends (Sat–Sun)</option>
            <option value="CUSTOM">Custom — pick days manually</option>
          </select>
          <p className="text-[10px] text-text-muted mt-1">
            {type === 'CUSTOM'
              ? 'Add time blocks below and select which days each applies to.'
              : `Active days: ${PROFILE_DAYS[type as Exclude<ProfileType, 'CUSTOM'>].map((d) => DAY_LABELS[d]).join(', ')}`}
          </p>
        </div>
      </div>

      {/* Add new time block */}
      <div className="border border-border rounded-xl p-4 space-y-3 bg-bg-surface">
        <h3 className="text-xs font-semibold text-foreground-primary uppercase tracking-wider">
          Add Time Block
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Start</label>
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="input-field w-28"
            />
          </div>
          <span className="text-text-muted pt-4">to</span>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">End</label>
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="input-field w-28"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1.5">Apply to days</label>
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((day) => {
              const covered = coveredDays.has(day)
              return (
                <label
                  key={day}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    newDays.includes(day)
                      ? 'bg-accent/20 border-accent/40 text-accent'
                      : covered
                        ? 'bg-navy-light border-navy-border text-text-muted opacity-40 cursor-not-allowed'
                        : 'bg-navy-light border-navy-border text-foreground-secondary hover:border-accent/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={newDays.includes(day)}
                    disabled={covered}
                    onChange={() => toggleNewDay(day)}
                    className="sr-only"
                  />
                  {DAY_LABELS[day]}
                </label>
              )
            })}
          </div>
          <p className="text-[10px] text-text-muted mt-1">
            {newDays.length === 0
              ? 'Select at least one day'
              : `${newDays.map((d) => DAY_LABELS[d]).join(', ')} will be set to ${newStart}–${newEnd}`}
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={!newStart || !newEnd || newDays.length === 0}
          className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add
        </button>
      </div>

      {/* Current entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground-primary uppercase tracking-wider">
            Current Schedule ({entries.length} block{entries.length !== 1 ? 's' : ''})
          </h3>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-border bg-bg-surface"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-mono font-bold text-foreground-primary shrink-0">
                  {entry.start}–{entry.end}
                </span>
                <span className="text-xs text-text-muted truncate">
                  {entry.days.map((d) => DAY_LABELS[d]).join(', ')}
                </span>
              </div>
              <button
                onClick={() => handleRemove(entry.id)}
                className="shrink-0 text-text-muted hover:text-feedback-error text-sm leading-none px-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save button + feedback */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || entries.length === 0}
          className="btn-gold text-sm disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
        {message && (
          <span className={`text-xs font-semibold ${message.ok ? 'text-feedback-success' : 'text-feedback-error'}`}>
            {message.ok ? '✅ ' : '❌ '}{message.text}
          </span>
        )}
      </div>
    </div>
  )
}
