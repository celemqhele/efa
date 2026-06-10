'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface UnscheduledInfo {
  tournamentId: string
  tournamentName: string
  totalUnscheduled: number
  nextMatchday: number | null
  matchdayCounts: Record<number, number>
}

interface ScheduleResult {
  id: string
  assigned_day: string
  window: string
}

export default function ScheduleRoundPanel() {
  const [tournaments, setTournaments] = useState<UnscheduledInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null)
  const [results, setResults] = useState<{ tournamentId: string; matchday: number; fixtures: ScheduleResult[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTournaments()
  }, [])

  async function fetchTournaments() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tournaments')
      const tns = await res.json() as any[]

      // For each tournament, fetch unscheduled info
      const infos: UnscheduledInfo[] = []
      for (const t of tns) {
        const infoRes = await fetch(`/api/admin/schedule-fixtures?tournamentId=${t.id}`)
        if (!infoRes.ok) continue
        const info = await infoRes.json()
        if (info.totalUnscheduled > 0) {
          infos.push({
            tournamentId: t.id,
            tournamentName: t.name,
            totalUnscheduled: info.totalUnscheduled,
            nextMatchday: info.nextMatchday,
            matchdayCounts: info.matchdayCounts,
          })
        }
      }
      setTournaments(infos)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSchedule(tournamentId: string) {
    setSchedulingFor(tournamentId)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/admin/schedule-fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scheduling failed')
      setResults({
        tournamentId,
        matchday: data.matchday,
        fixtures: data.results ?? [],
      })
      // Refresh tournaments list
      setTimeout(fetchTournaments, 500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSchedulingFor(null)
    }
  }

  if (loading) {
    return (
      <Card className="p-space-5">
        <p className="text-sm text-text-muted">Checking for unscheduled fixtures…</p>
      </Card>
    )
  }

  if (tournaments.length === 0) {
    return null
  }

  return (
    <Card className="p-space-5 space-y-space-4 border-accent/20 bg-accent/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-accent">
          ⏳ Pending Scheduling
        </h2>
        <Button
          variant="secondary"
          className="text-[10px] py-1 px-2"
          onClick={fetchTournaments}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      <div className="space-y-space-3">
        {tournaments.map((t) => (
          <div key={t.tournamentId} className="flex items-center justify-between gap-space-4 p-space-3 rounded-lg bg-bg-elevated border border-border">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">{t.tournamentName}</p>
              <p className="text-xs text-text-muted">
                {t.totalUnscheduled} fixture{t.totalUnscheduled !== 1 ? 's' : ''} across {Object.keys(t.matchdayCounts).length} matchday{Object.keys(t.matchdayCounts).length !== 1 ? 's' : ''}
                {t.nextMatchday ? ` · Next: MD${t.nextMatchday}` : ''}
              </p>
            </div>
            <Button
              onClick={() => handleSchedule(t.tournamentId)}
              isLoading={schedulingFor === t.tournamentId}
              variant="primary"
              className="text-xs whitespace-nowrap"
            >
              Schedule MD{t.nextMatchday ?? '?'}
            </Button>
          </div>
        ))}
      </div>

      {results && (
        <div className="p-space-3 rounded-lg bg-feedback-success/10 border border-feedback-success/20">
          <p className="text-xs font-bold text-feedback-success mb-space-2">
            ✓ MD{results.matchday} scheduled — {results.fixtures.length} fixture{results.fixtures.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto text-[10px] text-text-secondary font-mono">
            {results.fixtures.map((r) => (
              <div key={r.id} className="flex gap-2">
                <span className="text-text-muted">{r.id.slice(0, 8)}</span>
                <span className="font-bold text-text-primary">{r.assigned_day}</span>
                <span>{r.window}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-feedback-error font-bold">{error}</p>
      )}
    </Card>
  )
}
