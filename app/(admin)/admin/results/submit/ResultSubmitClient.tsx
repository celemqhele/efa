'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { cropToStatsPanel, parseOcrText } from '@/lib/parse-screenshot-client'

interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

interface Fixture {
  id: string
  matchday: number
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

type StatusFilter = 'all' | 'awaiting_confirmation' | 'scheduled'

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

  // Score state
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [isOverride, setIsOverride] = useState(false)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const selectedFixture = pendingFixtures.find((f) => f.id === selectedFixtureId) ?? null
  const existingConfs = selectedFixtureId ? (confirmationsByFixture[selectedFixtureId] ?? []) : []

  // Advanced Filter Logic (Handles multi-word search & status buttons)
  const filteredFixtures = pendingFixtures.filter((fx) => {
    // 1. Status Filter check
    if (statusFilter !== 'all' && fx.status !== statusFilter) {
      return false
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

    const payload = {
      fixture_id: selectedFixtureId,
      home_score: parseInt(homeScore),
      away_score: parseInt(awayScore),
      home_absent: homeAbsent,
      away_absent: awayAbsent,
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

  if (submitSuccess) {
    return (
      <div className="card p-12 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Result Finalised</h2>
        <p className="text-slate-400 mb-6">The result has been saved and standings updated.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setSubmitSuccess(false); resetOcr(); setSelectedFixtureId('') }} className="btn-outline">
            Submit Another
          </button>
          <a href="/admin/dashboard" className="btn-gold">Back to Dashboard</a>
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
                statusFilter === 'all' ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('awaiting_confirmation')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === 'awaiting_confirmation' ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('scheduled')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded transition-colors ${
                statusFilter === 'scheduled' ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              Scheduled
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
              <p className="text-slate-500 text-sm text-center py-4">No fixtures found.</p>
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
                      ? 'bg-gold/10 border-gold/40 text-slate-900'
                      : 'bg-navy-light border-navy-border text-slate-700 hover:border-gold/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">
                      {fx.home_team?.name} vs {fx.away_team?.name}
                    </span>
                    {hasConflict && <span className="text-red-400 text-xs ml-1 shrink-0">⚠</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-slate-500 text-xs">MD{fx.matchday}</span>
                    <span className={`text-xs px-1.5 rounded ${
                      fx.status === 'awaiting_confirmation'
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-slate-400 bg-slate-500/10'
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
            <h2 className="text-sm font-bold text-slate-900 mb-3">Submitted Scores</h2>
            <div className="space-y-2">
              {existingConfs.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-navy-light rounded px-3 py-2 border border-navy-border">
                  <span className="text-slate-400 text-xs">Submission {i + 1}</span>
                  <span className="font-bold text-slate-900">{c.home_score} – {c.away_score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Form */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedFixture ? (
          <div className="card p-12 text-center text-slate-500">
            <p className="text-4xl mb-3">⚽</p>
            <p>Select a fixture to submit its result.</p>
          </div>
        ) : (
          <>
            {/* Fixture Header */}
            <div className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    {selectedFixture.home_team?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(selectedFixture.home_team.logo_league_folder, selectedFixture.home_team.logo_team_slug, 'fixture_card')}
                        alt={selectedFixture.home_team.name}
                        width={48} height={48}
                        className="object-contain mx-auto"
                      />
                    )}
                    <p className="text-slate-900 text-xs font-bold mt-1 max-w-[80px] truncate">{selectedFixture.home_team?.name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">MD{selectedFixture.matchday}</p>
                    <p className="text-gold font-bold text-xl">vs</p>
                    <p className="text-slate-500 text-xs truncate max-w-[90px]">{selectedFixture.tournament?.name}</p>
                  </div>
                  <div className="text-center">
                    {selectedFixture.away_team?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(selectedFixture.away_team.logo_league_folder, selectedFixture.away_team.logo_team_slug, 'fixture_card')}
                        alt={selectedFixture.away_team.name}
                        width={48} height={48}
                        className="object-contain mx-auto"
                      />
                    )}
                    <p className="text-slate-900 text-xs font-bold mt-1 max-w-[80px] truncate">{selectedFixture.away_team?.name}</p>
                  </div>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-navy-border self-center sm:self-auto shrink-0">
                  <button
                    onClick={() => setMode('screenshot')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'screenshot' ? 'bg-gold text-navy' : 'bg-navy-light text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Screenshot
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'manual' ? 'bg-gold text-navy' : 'bg-navy-light text-slate-400 hover:text-slate-900'
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
                    <div className="text-4xl mb-2">📸</div>
                    <p className="text-slate-700 text-sm font-medium">Click to upload screenshot</p>
                    <p className="text-slate-500 text-xs mt-1">PNG, JPG up to 10MB</p>
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
                    <p className="mt-3 text-xs text-green-400 text-center">✓ Parsed</p>
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
                      <h3 className="text-sm font-bold text-slate-900 mb-3">Team Verification</h3>
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
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-light text-slate-600 hover:text-gold hover:border-gold border border-navy-border transition-colors"
                >
                  ⇄ Swap Home/Away
                </button>
              </div>

              <div className="flex gap-4 mb-4">
                <label className={`flex items-center gap-2 cursor-pointer flex-1 rounded-lg px-3 py-2 border transition-colors ${
                  homeAbsent ? 'border-red-400/50 bg-red-50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={homeAbsent}
                    onChange={(e) => setHomeAbsent(e.target.checked)}
                    className="accent-red-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {selectedFixture.home_team?.name} absent
                  </span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer flex-1 rounded-lg px-3 py-2 border transition-colors ${
                  awayAbsent ? 'border-red-400/50 bg-red-50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={awayAbsent}
                    onChange={(e) => setAwayAbsent(e.target.checked)}
                    className="accent-red-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {selectedFixture.away_team?.name} absent
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
                  <div className="grid grid-cols-3 text-xs text-slate-500 px-1 mb-1">
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
                      <span className="text-slate-400 text-xs text-center">{f.label}</span>
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
                    <p className="text-slate-900 font-bold mt-1">{selectedFixture.home_team?.name}</p>
                  </div>
                  <div className="text-5xl font-black text-slate-900">
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
                    <p className="text-slate-900 font-bold mt-1">{selectedFixture.away_team?.name}</p>
                  </div>
                </div>
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
