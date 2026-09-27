/**
 * Client-safe helper describing a poll pick's 24-hour change window.
 *
 * A pick is stored as status 'pending' with auto_approve_at = pick + 24h. The
 * hourly /api/cron/approve-poll-picks job flips it to 'approved' once that time
 * passes, after which the withdraw route refuses it.
 */
export interface PickLockState {
  locked: boolean
  label: string
}

export function pickLockState(app: {
  status?: string | null
  auto_approve_at?: string | null
}): PickLockState {
  if (app.status === 'approved') return { locked: true, label: 'Locked in' }

  const at = app.auto_approve_at ? new Date(app.auto_approve_at).getTime() : NaN
  if (Number.isNaN(at)) return { locked: false, label: 'Can change any time' }

  const ms = at - Date.now()
  if (ms <= 0) return { locked: true, label: 'Locking shortly' }

  const hours = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return { locked: false, label: `${hours}h ${mins}m left to change` }
  return { locked: false, label: `${Math.max(mins, 1)}m left to change` }
}
