'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { addDays, format } from 'date-fns'

interface Props {
  tournamentId: string
  tournamentName: string
  type?: string
}

const MATCHES_PER_WEEK = 30

export default function GenerateFixturesButton({ tournamentId, tournamentName, type }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [teamCount, setTeamCount] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!startDate || !settings) return
    const fixtureMode = settings?.fixture_mode
    const numGroups = settings?.num_groups
    const teamsPerGroup = settings?.teams_per_group
    const numRounds = settings?.num_rounds ?? 2
    const n = teamCount ?? 20

    let estMatches = 0
    if (fixtureMode === 'groups' && numGroups && teamsPerGroup) {
      estMatches = numGroups * teamsPerGroup * (teamsPerGroup - 1) * numRounds / 2
    } else {
      estMatches = n * (n - 1) * numRounds / 2
    }
    const estWeeks = Math.max(1, Math.ceil(estMatches / MATCHES_PER_WEEK))
    const end = addDays(new Date(startDate), estWeeks * 7)
    setEndDate(format(end, 'yyyy-MM-dd'))
  }, [startDate, settings, teamCount])

  if (type === 'friendlies') return null

  async function openDialog() {
    setDialogOpen(true)
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setError('')
    if (!settings) {
      try {
        const res = await fetch(`/api/admin/tournaments?id=${tournamentId}`)
        const data = await res.json()
        if (res.ok && data.tournament) {
          setSettings(data.tournament.settings ?? {})
          setTeamCount(data.tournament.team_count ?? null)
        }
      } catch {
        // non-critical
      }
    }
  }

  async function handleGenerate() {
    if (!startDate) return
    setDialogOpen(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/generate-fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, start_date: startDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setTimeout(() => router.refresh(), 1200)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <BottomSheet open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <h3 className="text-text-primary font-bold text-lg mb-1">Generate Fixtures</h3>
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          Set the start date for {tournamentName}. The end date is estimated based on match count and daily caps.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">
              Estimated End Date
              <span className="ml-1 text-[10px]">(auto-calculated)</span>
            </label>
            <input
              type="date"
              value={endDate}
              readOnly
              className="input-field w-full opacity-50 cursor-not-allowed bg-bg-elevated"
            />
          </div>
        </div>

        <div className="flex gap-space-2 justify-end">
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleGenerate} disabled={!startDate}>
            Generate
          </Button>
        </div>
      </BottomSheet>

      {error && <span className="text-red-400 text-[10px]">{error}</span>}
      <button
        onClick={openDialog}
        disabled={loading}
        className="btn-gold text-[10px] py-1 px-2"
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
            ...ing
          </span>
        ) : (
          'Generate Fixtures'
        )}
      </button>
    </>
  )
}
