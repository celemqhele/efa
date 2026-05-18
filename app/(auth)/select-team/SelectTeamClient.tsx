'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { RegistryEntry, TeamEntry } from './registry'

interface DbTeam {
  id: string
  logo_league_folder: string
  logo_team_slug: string
  manager_id: string | null
}

interface Props {
  registry: RegistryEntry[]
}

function logoSrc(folder: string, slug: string) {
  return `/logos/${folder}/128x128/${slug}.png`
}

export default function SelectTeamClient({ registry }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'clubs' | 'national'>('clubs')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<{ entry: RegistryEntry; team: TeamEntry } | null>(null)
  const [search, setSearch] = useState('')
  const [dbTeams, setDbTeams] = useState<DbTeam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, logo_league_folder, logo_team_slug, manager_id')
      .then(({ data }) => setDbTeams(data ?? []))
  // supabase ref is stable — intentional empty-ish dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nationalEntries = useMemo(() => registry.filter((e) => e.isNational), [registry])
  const clubEntries = useMemo(() => registry.filter((e) => !e.isNational), [registry])
  const regions = useMemo(
    () => clubEntries.map((e) => e.region).filter((r, i, arr) => arr.indexOf(r) === i).sort(),
    [clubEntries]
  )
  const leaguesInRegion = useMemo(
    () => clubEntries.filter((e) => e.region === selectedRegion),
    [clubEntries, selectedRegion]
  )
  const selectedEntry = useMemo(
    () => registry.find((e) => e.folder === selectedFolder) ?? null,
    [registry, selectedFolder]
  )

  const visibleNationalTeams = useMemo(() => {
    const q = search.toLowerCase()
    return nationalEntries.flatMap((entry) =>
      entry.teams
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .map((t) => ({ entry, team: t }))
    )
  }, [nationalEntries, search])

  function isTaken(folder: string, slug: string) {
    const db = dbTeams.find((t) => t.logo_league_folder === folder && t.logo_team_slug === slug)
    return !!(db?.manager_id)
  }

  function switchMode(next: 'clubs' | 'national') {
    setMode(next)
    setSelectedTeam(null)
    setSearch('')
    setSelectedRegion('')
    setSelectedFolder('')
  }

  async function handleConfirm() {
    if (!selectedTeam) return
    setLoading(true)
    setError('')

    const { entry, team } = selectedTeam
    const res = await fetch('/api/team/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: entry.folder, slug: team.slug, name: team.name }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to claim team.')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#0a1128] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center mb-3">
            <span className="text-[#0a1128] font-black text-lg">EFA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Choose Your Team</h1>
          <p className="text-slate-400 text-sm mt-1">First come, first served</p>
        </div>

        <div className="card p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-navy-border">
            <button
              onClick={() => switchMode('clubs')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                mode === 'clubs' ? 'bg-[#c9a84c] text-[#0a1128]' : 'text-slate-400 hover:text-white'
              }`}
            >
              Clubs
            </button>
            <button
              onClick={() => switchMode('national')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                mode === 'national'
                  ? 'bg-[#c9a84c] text-[#0a1128]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              National Teams
            </button>
          </div>

          {/* ── CLUBS ── */}
          {mode === 'clubs' && (
            <>
              <div>
                <label className="form-label">Region</label>
                <select
                  className="input-field"
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value)
                    setSelectedFolder('')
                    setSelectedTeam(null)
                  }}
                >
                  <option value="">Select a region…</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRegion && (
                <div>
                  <label className="form-label">League</label>
                  <select
                    className="input-field"
                    value={selectedFolder}
                    onChange={(e) => {
                      setSelectedFolder(e.target.value)
                      setSelectedTeam(null)
                    }}
                  >
                    <option value="">Select a league…</option>
                    {leaguesInRegion.map((e) => (
                      <option key={e.folder} value={e.folder}>
                        {e.country} — {e.league}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedEntry && (
                <div>
                  <label className="form-label">Select Club</label>
                  <TeamGrid
                    entry={selectedEntry}
                    dbTeams={dbTeams}
                    selected={selectedTeam}
                    onSelect={setSelectedTeam}
                  />
                </div>
              )}
            </>
          )}

          {/* ── NATIONAL ── */}
          {mode === 'national' && (
            <>
              <div>
                <input
                  type="search"
                  placeholder="Search country…"
                  className="input-field"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {visibleNationalTeams.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No countries found.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto pr-1">
                  {visibleNationalTeams.map(({ entry, team }) => {
                    const taken = isTaken(entry.folder, team.slug)
                    const isSelected =
                      selectedTeam?.team.slug === team.slug &&
                      selectedTeam?.entry.folder === entry.folder
                    return (
                      <TeamButton
                        key={`${entry.folder}-${team.slug}`}
                        team={team}
                        entry={entry}
                        taken={taken}
                        selected={isSelected}
                        onClick={() => !taken && setSelectedTeam({ entry, team })}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Selected preview */}
          {selectedTeam && (
            <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4 flex items-center gap-4">
              <Image
                src={logoSrc(selectedTeam.entry.folder, selectedTeam.team.slug)}
                alt={selectedTeam.team.name}
                width={64}
                height={64}
                className="object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.opacity = '0.3'
                }}
              />
              <div>
                <p className="font-semibold text-white">{selectedTeam.team.name}</p>
                <p className="text-xs text-slate-400">
                  {selectedTeam.entry.isNational
                    ? selectedTeam.entry.league
                    : `${selectedTeam.entry.country} · ${selectedTeam.entry.league}`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selectedTeam || loading}
            className="btn-gold w-full justify-center py-3 disabled:opacity-40"
          >
            {loading
              ? 'Saving…'
              : selectedTeam
              ? `Confirm — ${selectedTeam.team.name}`
              : 'Select a team first'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamGrid({
  entry,
  dbTeams,
  selected,
  onSelect,
}: {
  entry: RegistryEntry
  dbTeams: DbTeam[]
  selected: { entry: RegistryEntry; team: TeamEntry } | null
  onSelect: (val: { entry: RegistryEntry; team: TeamEntry }) => void
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
      {entry.teams.map((team) => {
        const db = dbTeams.find(
          (t) => t.logo_league_folder === entry.folder && t.logo_team_slug === team.slug
        )
        const taken = !!(db?.manager_id)
        const isSelected =
          selected?.entry.folder === entry.folder && selected?.team.slug === team.slug
        return (
          <TeamButton
            key={team.slug}
            team={team}
            entry={entry}
            taken={taken}
            selected={isSelected}
            onClick={() => !taken && onSelect({ entry, team })}
          />
        )
      })}
    </div>
  )
}

function TeamButton({
  team,
  entry,
  taken,
  selected,
  onClick,
}: {
  team: TeamEntry
  entry: RegistryEntry
  taken: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={taken}
      className={`
        flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
        ${
          taken
            ? 'opacity-40 cursor-not-allowed border-navy-border bg-navy-light'
            : selected
            ? 'border-[#c9a84c] bg-[#c9a84c]/10 shadow-[0_0_12px_rgba(201,168,76,0.2)]'
            : 'border-navy-border bg-navy-light hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5'
        }
      `}
    >
      <div className="w-12 h-12 flex items-center justify-center">
        <Image
          src={logoSrc(entry.folder, team.slug)}
          alt={team.name}
          width={48}
          height={48}
          className="object-contain w-full h-full"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.opacity = '0.3'
          }}
        />
      </div>
      <span className="text-[10px] text-center leading-tight text-slate-300 font-medium line-clamp-2">
        {team.name}
      </span>
      {taken && <span className="text-[9px] text-red-400">Taken</span>}
    </button>
  )
}
