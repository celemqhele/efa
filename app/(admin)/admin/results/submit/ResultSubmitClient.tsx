'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { cropToStatsPanel, parseOcrText } from '@/lib/parse-screenshot-client'
import { notify } from '@/lib/notifications'
import ForfeitBalanceBadge from '@/components/ui/ForfeitBalanceBadge'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, Camera, Flag, CircleDot, Check } from 'lucide-react'

interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

interface Fixture {
  id: string
  matchday: number
  round_type: string
  leg: number
  tournament_id: string
  scheduled_date: string | null
  status: 'scheduled' | 'awaiting_confirmation' | string
  tournament: { id: string; name: string; type: string } | null
  home_team: Team | null
  away_team: Team | null
}

interface Confirmation {
  fixture_id: string
  home_score: number
  away_score: number
  submitted_by: string
  confirmed_at: string
}

interface TeamNameMapping {
  id: string
  ocr_name: string
  team_id: string
}

interface Props {
  pendingFixtures: Fixture[]
  confirmationsByFixture: Record<string, Confirmation[]>
  teamNameMappings: TeamNameMapping[]
  allTeams: Team[]
  defaultFixtureId?: string
}

interface OcrResult {
  home_team_name: string
  away_team_name: string
  home_score: number
  away_score: number
  stats: {
    home_possession?: number
    away_possession?: number
    home_shots?: number
    away_shots?: number
    home_shots_on_target?: number
    away_shots_on_target?: number
    home_fouls?: number
    away_fouls?: number
    home_offsides?: number
    away_offsides?: number
    home_corners?: number
    away_corners?: number
    home_free_kicks?: number
    away_free_kicks?: number
    home_passes?: number
    away_passes?: number
    home_successful_passes?: number
    away_successful_passes?: number
    home_crosses?: number
    away_crosses?: number
    home_interceptions?: number
    away_interceptions?: number
    home_tackles?: number
    away_tackles?: number
    home_saves?: number
    away_saves?: number
  }
}

const STAT_FIELDS = [
  { key: 'possession', label: 'Possession (%)' },
  { key: 'shots', label: 'Shots' },
  { key: 'shots_on_target', label: 'Shots on Target' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'offsides', label: 'Offsides' },
  { key: 'corners', label: 'Corner Kicks' },
  { key: 'free_kicks', label: 'Free Kicks' },
  { key: 'passes', label: 'Passes' },
  { key: 'successful_passes', label: 'Successful Passes' },
  { key: 'crosses', label: 'Crosses' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'saves', label: 'Saves' },
] as const

type StatKey = (typeof STAT_FIELDS)[number]['key']

interface StatValues {
  [key: string]: { home: string; away: string }
}

type StatusFilter = 'all' | 'awaiting_confirmation' | 'scheduled' | 'completed'

export default function ResultSubmitClient({
  pendingFixtures,
  confirmationsByFixture,
  teamNameMappings,
  allTeams,
  defaultFixtureId,
}: Props) {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(defaultFixtureId ?? '')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [mode, setMode] = useState<'screenshot' | 'manual'>('screenshot')

  // Screenshot / OCR state
  const fileRef = useRef<HTMLInputElement>(null)
  const [ocrProgress, setOcrProgress] = useState(0)   // 0–100, 0 = idle
  const [ocrStatus, setOcrStatus] = useState('')
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [ocrError, setOcrError] = useState('')

  // Team mapping state (after OCR)
  const [mappedHomeTeamId, setMappedHomeTeamId] = useState('')
  const [mappedAwayTeamId, setMappedAwayTeamId] = useState('')

  // Stat editor state
  const [stats, setStats] = useState<StatValues>(() =>
    Object.fromEntries(STAT_FIELDS.map((f) => [f.key, { home: '', away: '' }]))
  )

  // Absent state
  const [homeAbsent, setHomeAbsent] = useState(false)
  const [awayAbsent, setAwayAbsent] = useState(false)
  
  // Abandon state
  const [homeForfeit, setHomeForfeit] = useState(false)
  const [awayForfeit, setAwayForfeit] = useState(false)

  // Forfeit balance state
  const [forfeitBalances, setForfeitBalances] = useState<any[]>([])
  const [balanceLoading, setBalanceLoading] = useState(false)

  async function handleUseForfeitBalance(balanceId: string) {
    const res = await fetch('/api/admin/forfeit-balances/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance_id: balanceId }),
    })
    if (res.ok) {
      setForfeitBalances((prev) =>
        prev.map((x: any) =>
          x.id === balanceId ? { ...x, remaining: x.remaining - 1 } : x
        ).filter((x: any) => x.remaining > 0)
      )
    }
  }

  // Score state
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [isOverride, setIsOverride] = useState(false)

  // Penalty state (for 2-leg knockout)
  const [penHomeScore, setPenHomeScore] = useState('')
  const [penAwayScore, setPenAwayScore] = useState('')
  const [showPenalties, setShowPenalties] = useState(false)
  const [leg1Aggregate, setLeg1Aggregate] = useState<{ home: number; away: number } | null>(null)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Reset state
  const [resetLoading, setResetLoading] = useState(false)

  const selectedFixture = pendingFixtures.find((f) => f.id === selectedFixtureId) ?? null
  const existingConfs = selectedFixtureId ? (confirmationsByFixture[selectedFixtureId] ?? []) : []

  const isFinished = selectedFixture ? ['completed', 'confirmed', 'abandoned'].includes(selectedFixture.status) : false

  // Advanced Filter Logic (Handles multi-word search & status buttons)
  const filteredFixtures = pendingFixtures.filter((fx) => {
    // 1. Status Filter check
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        if (!['completed', 'confirmed', 'abandoned'].includes(fx.status)) return false
      } else if (fx.status !== statusFilter) {
        return false
      }
    }

    // 2. Multi-word Search check
    if (!search) return true
    
    // Split text by spaces and filter out empty strings
    const searchWords = search.toLowerCase().split(/\s+/).filter(Boolean)
    const homeName = fx.home_team?.name.toLowerCase() ?? ''
    const awayName = fx.away_team?.name.toLowerCase() ?? ''
    const combinedMatchText = `${homeName} vs ${awayName} ${fx.id.toLowerCase()}`

    // Every word typed must match somewhere in the combined match text string
    return searchWords.every((word) => combinedMatchText.includes(word))
  })

  // Auto-set scores when absent flags change
  useEffect(() => {
    if (homeAbsent && awayAbsent) {
      setHomeScore('0')
      setAwayScore('0')
    } else if (homeAbsent) {
      setHomeScore('0')
      setAwayScore('3')
    } else if (awayAbsent) {
      setHomeScore('3')
      setAwayScore('0')
    }
  }, [homeAbsent, awayAbsent])

  // Fetch forfeit balances when fixture changes
  useEffect(() => {
    if (!selectedFixtureId) { setForfeitBalances([]); return }
    const fixture = pendingFixtures.find(f => f.id === selectedFixtureId)
    if (!fixture?.home_team && !fixture?.away_team) return

    setBalanceLoading(true)
    const teamIds = [fixture.home_team?.id, fixture.away_team?.id].filter(Boolean)
    fetch(`/api/admin/forfeit-balances?teamIds=${teamIds.join(',')}`)
      .then(r => r.json())
      .then(data => setForfeitBalances(data.balances ?? []))
      .catch(() => setForfeitBalances([]))
      .finally(() => setBalanceLoading(false))
  }, [selectedFixtureId])

  // Fetch leg 1 aggregate for 2-leg knockout leg 2 fixtures
  useEffect(() => {
    setLeg1Aggregate(null)
    setShowPenalties(false)
    setPenHomeScore('')
    setPenAwayScore('')
    if (!selectedFixtureId) return
    const fixture = pendingFixtures.find(f => f.id === selectedFixtureId)
    if (!fixture) return
    if (fixture.leg !== 2 || !['qf', 'sf'].includes(fixture.round_type)) return

    const leg1Md = fixture.matchday - 10
    fetch(`/api/admin/fixtures/sibling?tournament_id=${fixture.tournament_id}&matchday=${leg1Md}`)
      .then(r => r.json())
      .then(data => {
        if (data.result) {
          setLeg1Aggregate({ home: data.result.home_score, away: data.result.away_score })
        }
      })
      .catch(() => {})
  }, [selectedFixtureId])

  function resetOcr() {
    setOcrResult(null)
    setOcrError('')
    setMappedHomeTeamId('')
    setMappedAwayTeamId('')
    setStats(Object.fromEntries(STAT_FIELDS.map((f) => [f.key, { home: '', away: '' }])))
    setHomeScore('')
    setAwayScore('')
    setHomeAbsent(false)
    setAwayAbsent(false)
  }

  async function handleScreenshotUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setOcrProgress(1)
    setOcrStatus('Cropping stats panel...')
    setOcrError('')
    setOcrResult(null)

    try {
      const croppedUrl = await cropToStatsPanel(file)
      setOcrStatus('Reading text...')
      setOcrProgress(10)

      const Tesseract = (await import('tesseract.js')).default
      const { data: { text } } = await Tesseract.recognize(croppedUrl, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(10 + m.progress * 85))
            setOcrStatus(`Reading... ${Math.round(m.progress * 100)}%`)
          } else if (m.status === 'loading tesseract core') {
            setOcrStatus('Loading engine...')
            setOcrProgress(3)
          } else if (m.status === 'initializing tesseract') {
            setOcrStatus('Initialising...')
            setOcrProgress(5)
          } else if (m.status === 'loading language traineddata') {
            setOcrStatus('Loading language...')
            setOcrProgress(7)
          }
        },
      })

      URL.revokeObjectURL(croppedUrl)
      setOcrStatus('Parsing...')
      setOcrProgress(97)

      const parsed = parseOcrText(text)

      const ocr: OcrResult = {
        home_team_name: parsed.homeTeamOcr,
        away_team_name: parsed.awayTeamOcr,
        home_score: parsed.homeScore,
        away_score: parsed.awayScore,
        stats: parsed.stats as any,
      }

      setOcrResult(ocr)
      setHomeScore(String(ocr.home_score))
      setAwayScore(String(ocr.away_score))

      const newStats: StatValues = {}
      for (const f of STAT_FIELDS) {
        newStats[f.key] = {
          home: String(parsed.stats[`home_${f.key}`] ?? ''),
          away: String(parsed.stats[`away_${f.key}`] ?? ''),
        }
      }
      setStats(newStats)

      const homeMapping = teamNameMappings.find(
        (m) => m.ocr_name.toLowerCase() === ocr.home_team_name.toLowerCase()
      )
      const awayMapping = teamNameMappings.find(
        (m) => m.ocr_name.toLowerCase() === ocr.away_team_name.toLowerCase()
      )
      if (homeMapping) setMappedHomeTeamId(homeMapping.team_id)
      else if (selectedFixture?.home_team) setMappedHomeTeamId(selectedFixture.home_team.id)
      if (awayMapping) setMappedAwayTeamId(awayMapping.team_id)
      else if (selectedFixture?.away_team) setMappedAwayTeamId(selectedFixture.away_team.id)

      setOcrProgress(100)
      setOcrStatus('Done')
    } catch (err: any) {
      setOcrError(err.message)
      setOcrProgress(0)
      setOcrStatus('')
    }
  }

  function updateStat(key: string, side: 'home' | 'away', value: string) {
    setStats((prev) => ({ ...prev, [key]: { ...prev[key], [side]: value } }))
  }

  function handleSwap() {
    // 1. Swap scores
    const tempHomeScore = homeScore
    setHomeScore(awayScore)
    setAwayScore(tempHomeScore)

    // 2. Swap stats
    const newStats: StatValues = {}
    for (const f of STAT_FIELDS) {
      newStats[f.key] = {
        home: stats[f.key]?.away ?? '',
        away: stats[f.key]?.home ?? '',
      }
    }
    setStats(newStats)

    // 3. Swap absence flags
    const tempHomeAbsent = homeAbsent
    setHomeAbsent(awayAbsent)
    setAwayAbsent(tempHomeAbsent)

    // 4. Swap mapped team IDs (used in OCR verification)
    const tempHomeId = mappedHomeTeamId
    setMappedHomeTeamId(mappedAwayTeamId)
    setMappedAwayTeamId(tempHomeId)
  }

  async function handleSubmit() {
    if (!selectedFixtureId) return setSubmitError('Select a fixture first.')
    if (!(homeAbsent || awayAbsent) && (!homeScore || !awayScore)) return setSubmitError('Score is required.')
    if (isOverride && !overrideReason.trim() && !(homeAbsent || awayAbsent)) return setSubmitError('Override reason is required.')

    setSubmitting(true)
    setSubmitError('')

    const payload: Record<string, any> = {
      fixture_id: selectedFixtureId,
      home_score: parseInt(homeScore),
      away_score: parseInt(awayScore),
      home_absent: homeAbsent,
      away_absent: awayAbsent,
      home_forfeit: homeForfeit,
      away_forfeit: awayForfeit,
      override_reason: isOverride ? overrideReason : null,
      home_team_id: mappedHomeTeamId || selectedFixture?.home_team?.id,
      away_team_id: mappedAwayTeamId || selectedFixture?.away_team?.id,
      stats: Object.fromEntries(
        STAT_FIELDS.flatMap((f) => [
          [`home_${f.key}`, stats[f.key]?.home ? parseInt(stats[f.key]!.home) : null],
          [`away_${f.key}`, stats[f.key]?.away ? parseInt(stats[f.key]!.away) : null],
        ])
      ),
      ocr_home_name: ocrResult?.home_team_name ?? null,
      ocr_away_name: ocrResult?.away_team_name ?? null,
    }
    if (showPenalties && penHomeScore) payload.pen_home_score = parseInt(penHomeScore)
    if (showPenalties && penAwayScore) payload.pen_away_score = parseInt(penAwayScore)

    try {
      const res = await fetch('/api/admin/finalise-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submit failed')
      setSubmitSuccess(true)
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Reset handler
  async function handleReset() {
    if (!confirm('Are you sure you want to reset this fixture? This will delete the result and recalculate standings.')) return
    
    setResetLoading(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/admin/reset-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixture_id: selectedFixtureId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reset')
      
      // Refresh page
      window.location.reload()
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setResetLoading(false)
    }
  }

  if (submitSuccess) {
    return (
      <div className="card p-12 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground-primary mb-2">Result Finalised</h2>
        <p className="text-text-muted mb-6">The result has been saved and standings updated.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setSubmitSuccess(false); resetOcr(); setSelectedFixtureId('') }} className="btn-outline">
            Submit Another
          </button>
          <Link href="/admin/dashboard" className="btn-gold">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Fixture Selector */}
      <div className="lg:col-span-1 space-y-4">
        <div className="card p-4">
          <h2 className="section-header">Select Fixture</h2>
          
          {/* Status Filter Tab Selector */}
          <div className="flex rounded-lg overflow-hidden border border-navy-border p-0.5 bg-navy-light mb-3">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === 'all' ? 'bg-gold text-navy shadow-sm' : 'text-text-muted hover:text-foreground-primary'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('awaiting_confirmation')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === 'awaiting_confirmation' ? 'bg-gold text-navy shadow-sm' : 'text-text-muted hover:text-foreground-primary'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('scheduled')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === 'scheduled' ? 'bg-gold text-navy shadow-sm' : 'text-text-muted hover:text-foreground-primary'
              }`}
            >
              Sched.
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === 'completed' ? 'bg-gold text-navy shadow-sm' : 'text-text-muted hover:text-foreground-primary'
              }`}
            >
              Comp.
            </button>
          </div>

          <input
            type="text"
            placeholder="Search e.g. 'Chelsea Sunderland'..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field mb-3"
          />
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {filteredFixtures.length === 0 && (
              <p className="text-text-muted text-sm text-center py-4">No fixtures found.</p>
            )}
            {filteredFixtures.map((fx) => {
              const isSelected = fx.id === selectedFixtureId
              const confs = confirmationsByFixture[fx.id] ?? []
              const hasConflict = confs.length >= 2 && confs.some(
                (c) => c.home_score !== confs[0]!.home_score || c.away_score !== confs[0]!.away_score
              )
              return (
                <button
                  key={fx.id}
                  onClick={() => { setSelectedFixtureId(fx.id); resetOcr() }}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors text-sm ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-foreground-primary'
                      : 'bg-navy-light border-navy-border text-foreground-secondary hover:border-gold/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">
                      {fx.home_team?.name} vs {fx.away_team?.name}
                    </span>
                    {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 ml-1" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-text-muted text-xs">MD{fx.matchday}</span>
                    <span className={`text-xs px-1.5 rounded ${
                      fx.status === 'awaiting_confirmation'
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-text-muted bg-bg-surface0/10'
                    }`}>{fx.status.replace('_', ' ')}</span>
                    {confs.length > 0 && (
                      <span className="text-xs text-blue-400">{confs.length} conf.</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Existing Confirmations */}
        {selectedFixture && existingConfs.length > 0 && (
          <div className="card p-4">
            <h2 className="text-sm font-bold text-foreground-primary mb-3">Submitted Scores</h2>
            <div className="space-y-2">
              {existingConfs.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-navy-light rounded px-3 py-2 border border-navy-border">
                  <span className="text-text-muted text-xs">Submission {i + 1}</span>
                  <span className="font-bold text-foreground-primary">{c.home_score} – {c.away_score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Form */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedFixture ? (
          <div className="card p-12 text-center text-text-muted">
            <CircleDot className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p>Select a fixture to submit its result.</p>
          </div>
        ) : isFinished ? (
          <div className="card p-12 text-center space-y-6">
            <Flag className="w-12 h-12 text-text-muted mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-foreground-primary">Fixture Completed</h2>
              <p className="text-text-muted mt-2">
                This fixture already has a finalised result. 
                Resetting it will delete the result and return it to <span className="font-bold">Scheduled</span>.
              </p>
            </div>

            <div className="p-6 bg-navy-light rounded-2xl border border-navy-border inline-block min-w-[240px]">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  {selectedFixture.home_team?.logo_league_folder && (
                    <Image
                      src={getTeamLogo(selectedFixture.home_team.logo_league_folder, selectedFixture.home_team.logo_team_slug, 'fixture_card')}
                      alt={selectedFixture.home_team.name}
                      width={56} height={56}
                      className="object-contain mx-auto"
                    />
                  )}
                </div>
                <div className="text-3xl font-black text-foreground-primary">vs</div>
                <div className="text-center">
                  {selectedFixture.away_team?.logo_league_folder && (
                    <Image
                      src={getTeamLogo(selectedFixture.away_team.logo_league_folder, selectedFixture.away_team.logo_team_slug, 'fixture_card')}
                      alt={selectedFixture.away_team.name}
                      width={56} height={56}
                      className="object-contain mx-auto"
                    />
                  )}
                </div>
              </div>
              <p className="text-xs font-bold text-text-muted mt-4 uppercase tracking-widest">{selectedFixture.status}</p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleReset}
                disabled={resetLoading}
                className="btn-outline border-red-500/20 text-red-500 hover:bg-red-50 py-3 px-8 font-bold text-base"
              >
                {resetLoading ? 'Resetting...' : 'Reset Result & Recalculate Standings'}
              </button>
              {submitError && (
                <p className="text-red-500 text-sm mt-4 bg-red-50 p-3 rounded-lg border border-red-100">{submitError}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Fixture Header */}
            <div className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {selectedFixture.home_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(selectedFixture.home_team.logo_league_folder, selectedFixture.home_team.logo_team_slug, 'fixture_card')}
                          alt={selectedFixture.home_team.name}
                          width={48} height={48}
                          className="object-contain"
                        />
                      )}
                      <ForfeitBalanceBadge
                        teamId={selectedFixture.home_team?.id ?? ''}
                        teamName={selectedFixture.home_team?.name ?? ''}
                        balances={forfeitBalances}
                        onUse={handleUseForfeitBalance}
                      />
                    </div>
                    <p className="text-foreground-primary text-xs font-bold mt-1 max-w-[80px] truncate">{selectedFixture.home_team?.name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-text-muted text-xs">MD{selectedFixture.matchday}</p>
                    <p className="text-gold font-bold text-xl">vs</p>
                    <p className="text-text-muted text-xs truncate max-w-[90px]">{selectedFixture.tournament?.name}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {selectedFixture.away_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(selectedFixture.away_team.logo_league_folder, selectedFixture.away_team.logo_team_slug, 'fixture_card')}
                          alt={selectedFixture.away_team.name}
                          width={48} height={48}
                          className="object-contain"
                        />
                      )}
                      <ForfeitBalanceBadge
                        teamId={selectedFixture.away_team?.id ?? ''}
                        teamName={selectedFixture.away_team?.name ?? ''}
                        balances={forfeitBalances}
                        onUse={handleUseForfeitBalance}
                      />
                    </div>
                    <p className="text-foreground-primary text-xs font-bold mt-1 max-w-[80px] truncate">{selectedFixture.away_team?.name}</p>
                  </div>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-navy-border self-center sm:self-auto shrink-0">
                  <button
                    onClick={() => setMode('screenshot')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'screenshot' ? 'bg-gold text-navy' : 'bg-navy-light text-text-muted hover:text-foreground-primary'
                    }`}
                  >
                    Screenshot
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'manual' ? 'bg-gold text-navy' : 'bg-navy-light text-text-muted hover:text-foreground-primary'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>
            </div>

            {mode === 'screenshot' && (
              <div className="card p-5 space-y-4">
                <h2 className="section-header">Screenshot Upload</h2>

                <div className="border-2 border-dashed border-navy-border rounded-xl p-8 text-center">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScreenshotUpload}
                    id="screenshot-upload"
                  />
                  <label htmlFor="screenshot-upload" className="cursor-pointer block">
                    <Camera className="w-10 h-10 text-text-muted mx-auto mb-2" />
                    <p className="text-foreground-secondary text-sm font-medium">Click to upload screenshot</p>
                    <p className="text-text-muted text-xs mt-1">PNG, JPG up to 10MB</p>
                  </label>
                  {ocrProgress > 0 && ocrProgress < 100 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-gold">
                        <span>{ocrStatus}</span>
                        <span>{ocrProgress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-navy-border overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {ocrProgress === 100 && (
                    <p className="mt-3 text-xs text-green-400 text-center"><Check className="w-3.5 h-3.5 inline" /> Parsed</p>
                  )}
                </div>

                {ocrError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                    {ocrError}
                  </div>
                )}

                {ocrResult && (
                  <div className="space-y-4">
                    <div className="bg-navy-light rounded-lg p-4 border border-navy-border">
                      <h3 className="text-sm font-bold text-foreground-primary mb-3">Team Verification</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">OCR: &ldquo;{ocrResult.home_team_name}&rdquo;</label>
                          <select
                            value={mappedHomeTeamId}
                            onChange={(e) => setMappedHomeTeamId(e.target.value)}
                            className="input-field"
                          >
                            <option value="">-- Select EFA Team --</option>
                            {allTeams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {mappedHomeTeamId && (() => {
                            const t = allTeams.find((x) => x.id === mappedHomeTeamId)
                            return t?.logo_league_folder ? (
                              <div className="flex items-center gap-2 mt-2">
                                <Image
                                  src={getTeamLogo(t.logo_league_folder, t.logo_team_slug, 'standings_row')}
                                  alt={t.name} width={24} height={24} className="object-contain"
                                />
                                <span className="text-green-400 text-xs">{t.name}</span>
                              </div>
                            ) : null
                          })()}
                        </div>
                        <div>
                          <label className="form-label">OCR: &ldquo;{ocrResult.away_team_name}&rdquo;</label>
                          <select
                            value={mappedAwayTeamId}
                            onChange={(e) => setMappedAwayTeamId(e.target.value)}
                            className="input-field"
                          >
                            <option value="">-- Select EFA Team --</option>
                            {allTeams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {mappedAwayTeamId && (() => {
                            const t = allTeams.find((x) => x.id === mappedAwayTeamId)
                            return t?.logo_league_folder ? (
                              <div className="flex items-center gap-2 mt-2">
                                <Image
                                  src={getTeamLogo(t.logo_league_folder, t.logo_team_slug, 'standings_row')}
                                  alt={t.name} width={24} height={24} className="object-contain"
                                />
                                <span className="text-green-400 text-xs">{t.name}</span>
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Score Input */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header mb-0">Score</h2>
                <button
                  type="button"
                  onClick={handleSwap}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-light text-foreground-muted hover:text-gold hover:border-gold border border-navy-border transition-colors"
                >
                  ⇄ Swap Home/Away
                </button>
              </div>

              <div className="flex gap-4 mb-4">
                <label className={`flex items-center gap-2 cursor-pointer flex-1 rounded-lg px-3 py-2 border transition-colors ${
                  homeAbsent ? 'border-red-400/50 bg-red-50' : 'border-border bg-bg-surface'
                }`}>
                  <input
                    type="checkbox"
                    checked={homeAbsent}
                    onChange={(e) => setHomeAbsent(e.target.checked)}
                    className="accent-red-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground-secondary">
                    {selectedFixture.home_team?.name} absent
                  </span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer flex-1 rounded-lg px-3 py-2 border transition-colors ${
                  awayAbsent ? 'border-red-400/50 bg-red-50' : 'border-border bg-bg-surface'
                }`}>
                  <input
                    type="checkbox"
                    checked={awayAbsent}
                    onChange={(e) => setAwayAbsent(e.target.checked)}
                    className="accent-red-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground-secondary">
                    {selectedFixture.away_team?.name} absent
                  </span>
                </label>
              </div>

              <div className="flex gap-4 mb-4">
                <label className={`flex items-center gap-2 cursor-pointer flex-1 rounded-lg px-3 py-2 border transition-colors ${
                  homeForfeit ? 'border-orange-400/50 bg-orange-50' : 'border-border bg-bg-surface'
                }`}>
                  <input
                    type="checkbox"
                    checked={homeForfeit}
                    onChange={(e) => setHomeForfeit(e.target.checked)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground-secondary">
                    {selectedFixture.home_team?.name} forfeit (mid-game)
                  </span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer flex-1 rounded-lg px-3 py-2 border transition-colors ${
                  awayForfeit ? 'border-orange-400/50 bg-orange-50' : 'border-border bg-bg-surface'
                }`}>
                  <input
                    type="checkbox"
                    checked={awayForfeit}
                    onChange={(e) => setAwayForfeit(e.target.checked)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground-secondary">
                    {selectedFixture.away_team?.name} forfeit (mid-game)
                  </span>
                </label>
              </div>

              {(homeAbsent || awayAbsent) && (
                <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                  homeAbsent && awayAbsent
                    ? 'bg-orange-50 border border-orange-200 text-orange-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {homeAbsent && awayAbsent
                    ? 'Both absent — result is 0–0, no points awarded to either side.'
                    : homeAbsent
                    ? `${selectedFixture.home_team?.name} forfeits — result recorded as 0–3.`
                    : `${selectedFixture.away_team?.name} forfeits — result recorded as 3–0.`}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="form-label">{selectedFixture.home_team?.name}</label>
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    disabled={homeAbsent || awayAbsent}
                    onChange={(e) => { setHomeScore(e.target.value); setIsOverride(ocrResult ? e.target.value !== String(ocrResult.home_score) : false) }}
                    className="input-field text-center text-2xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
                <div className="text-gold text-3xl font-black pt-5">–</div>
                <div className="flex-1">
                  <label className="form-label">{selectedFixture.away_team?.name}</label>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    disabled={homeAbsent || awayAbsent}
                    onChange={(e) => { setAwayScore(e.target.value); setIsOverride(ocrResult ? e.target.value !== String(ocrResult.away_score) : false) }}
                    className="input-field text-center text-2xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Aggregate preview for 2-leg knockout leg 2 */}
              {leg1Aggregate && (
                <div className="mt-4 p-3 bg-bg-surface rounded-lg border border-gold/20">
                  <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Aggregate</div>
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-sm font-bold text-foreground-primary">{leg1Aggregate.home}</span>
                    <span className="text-xs text-text-muted">–</span>
                    <span className="text-sm font-bold text-foreground-primary">{leg1Aggregate.away}</span>
                    <span className="text-[10px] text-text-muted">(after leg 1)</span>
                  </div>
                  <div className="text-[10px] text-text-muted text-center mt-1">
                    + {homeScore || '?'} – {awayScore || '?'} (this leg)
                  </div>
                </div>
              )}

              {/* Penalties toggle for 2-leg knockout */}
              {selectedFixture?.leg === 2 && ['qf', 'sf'].includes(selectedFixture?.round_type ?? '') && (
                <div className="mt-4 p-3 bg-bg-surface rounded-lg border border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPenalties}
                      onChange={(e) => {
                        setShowPenalties(e.target.checked)
                        if (!e.target.checked) { setPenHomeScore(''); setPenAwayScore('') }
                      }}
                      className="w-4 h-4 text-gold border-border rounded focus:ring-gold"
                    />
                    <span className="text-sm font-medium text-foreground-secondary">Penalties?</span>
                  </label>
                  {showPenalties && (
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex-1">
                        <label className="form-label text-[10px]">{selectedFixture.home_team?.name ?? 'Home'}</label>
                        <input
                          type="number"
                          min="0"
                          value={penHomeScore}
                          onChange={(e) => setPenHomeScore(e.target.value)}
                          className="input-field text-center text-lg font-bold"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-gold text-xl font-black pt-5">–</div>
                      <div className="flex-1">
                        <label className="form-label text-[10px]">{selectedFixture.away_team?.name ?? 'Away'}</label>
                        <input
                          type="number"
                          min="0"
                          value={penAwayScore}
                          onChange={(e) => setPenAwayScore(e.target.value)}
                          className="input-field text-center text-lg font-bold"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isOverride && !(homeAbsent || awayAbsent) && (
                <div className="mt-4">
                  <label className="form-label text-yellow-400">Override Reason (required)</label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                    placeholder="Why does the score differ from the OCR result?"
                    className="input-field"
                  />
                </div>
              )}
            </div>

            {/* Stat Editor */}
            {selectedFixture && (
              <div className="card p-5">
                <h2 className="section-header">Match Stats</h2>
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-3 text-xs text-text-muted px-1 mb-1">
                    <span>{selectedFixture.home_team?.name}</span>
                    <span className="text-center">Stat</span>
                    <span className="text-right">{selectedFixture.away_team?.name}</span>
                  </div>
                  {STAT_FIELDS.map((f) => (
                    <div key={f.key} className="grid grid-cols-3 items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={stats[f.key]?.home ?? ''}
                        onChange={(e) => updateStat(f.key, 'home', e.target.value)}
                        className="input-field text-center py-2"
                        placeholder="—"
                      />
                      <span className="text-text-muted text-xs text-center">{f.label}</span>
                      <input
                        type="number"
                        min="0"
                        value={stats[f.key]?.away ?? ''}
                        onChange={(e) => updateStat(f.key, 'away', e.target.value)}
                        className="input-field text-center py-2"
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Panel */}
            {homeScore && awayScore && (
              <div className="card p-5 border-gold/20">
                <h2 className="section-header text-gold">Preview</h2>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="text-center">
                    {selectedFixture.home_team?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(selectedFixture.home_team.logo_league_folder, selectedFixture.home_team.logo_team_slug, 'fixture_card')}
                        alt={selectedFixture.home_team.name}
                        width={56} height={56}
                        className="object-contain mx-auto"
                      />
                    )}
                    <p className="text-foreground-primary font-bold mt-1">{selectedFixture.home_team?.name}</p>
                  </div>
                  <div className="text-5xl font-black text-foreground-primary">
                    {homeScore} – {awayScore}
                  </div>
                  <div className="text-center">
                    {selectedFixture.away_team?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(selectedFixture.away_team.logo_league_folder, selectedFixture.away_team.logo_team_slug, 'fixture_card')}
                        alt={selectedFixture.away_team.name}
                        width={56} height={56}
                        className="object-contain mx-auto"
                      />
                    )}
                    <p className="text-foreground-primary font-bold mt-1">{selectedFixture.away_team?.name}</p>
                  </div>
                </div>
                {leg1Aggregate && (
                  <p className="text-text-muted text-xs text-center mt-1">
                    AGG {leg1Aggregate.home + (parseInt(awayScore) || 0)} – {leg1Aggregate.away + (parseInt(homeScore) || 0)}
                  </p>
                )}
                {showPenalties && penHomeScore && penAwayScore && (
                  <p className="text-text-muted text-[10px] text-center mt-0.5">
                    pens {penHomeScore} – {penAwayScore}
                  </p>
                )}
                {isOverride && overrideReason && (
                  <p className="text-yellow-400 text-xs text-center">Override: {overrideReason}</p>
                )}
              </div>
            )}

            {/* Error / Submit */}
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {submitError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || (!(homeAbsent || awayAbsent) && (!homeScore || !awayScore))}
              className="btn-gold w-full py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Finalise Result'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

