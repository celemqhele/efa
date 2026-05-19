'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'

interface Team {
  id: string
  name: string
  logo_league_folder: string | null
  logo_team_slug: string | null
  manager_id: string | null
}

interface Props {
  teams: Team[]
}

function logoSrc(folder: string, slug: string) {
  return `/logos/${folder}/128x128/${slug}.png`
}

export default function SelectTeamClient({ teams }: Props) {
  const [selected, setSelected] = useState<Team | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return teams.filter((t) => !q || t.name.toLowerCase().includes(q))
  }, [teams, search])

  const available = filtered.filter((t) => !t.manager_id)
  const taken = filtered.filter((t) => t.manager_id)

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/team/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: selected.id }),
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
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center mb-3">
            <span className="text-[#0a1128] font-black text-lg">EFA</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Choose Your Club</h1>
          <p className="text-slate-500 text-sm mt-1">
            {available.length} club{available.length !== 1 ? 's' : ''} available to manage
          </p>
        </div>

        <div className="card p-6 space-y-5">
          {/* Search */}
          <input
            type="search"
            placeholder="Search clubs…"
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filtered.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">No clubs found.</p>
          )}

          {/* Available */}
          {available.length > 0 && (
            <div>
              <p className="form-label">Available</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
                {available.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    isSelected={selected?.id === team.id}
                    taken={false}
                    onSelect={() => setSelected(team)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Taken */}
          {taken.length > 0 && (
            <div>
              <p className="form-label">Taken</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1 opacity-60">
                {taken.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    isSelected={false}
                    taken={true}
                    onSelect={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Selected preview */}
          {selected && (
            <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4 flex items-center gap-4">
              {selected.logo_league_folder && selected.logo_team_slug ? (
                <Image
                  src={logoSrc(selected.logo_league_folder, selected.logo_team_slug)}
                  alt={selected.name}
                  width={56}
                  height={56}
                  className="object-contain bg-white rounded"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.opacity = '0.3'
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                  ?
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-500">Available to manage</p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="btn-gold w-full justify-center py-3 disabled:opacity-40"
          >
            {loading
              ? 'Saving…'
              : selected
              ? `Confirm — ${selected.name}`
              : 'Select a club first'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamCard({
  team,
  isSelected,
  taken,
  onSelect,
}: {
  team: Team
  isSelected: boolean
  taken: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      disabled={taken}
      className={`
        flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-left
        ${
          taken
            ? 'cursor-not-allowed border-slate-200 bg-slate-50'
            : isSelected
            ? 'border-[#c9a84c] bg-[#c9a84c]/10 shadow-[0_0_12px_rgba(201,168,76,0.2)]'
            : 'border-slate-200 bg-white hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 cursor-pointer'
        }
      `}
    >
      <div className="w-12 h-12 flex items-center justify-center">
        {team.logo_league_folder && team.logo_team_slug ? (
          <Image
            src={logoSrc(team.logo_league_folder, team.logo_team_slug)}
            alt={team.name}
            width={48}
            height={48}
            className="object-contain w-full h-full bg-white"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.opacity = '0.3'
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
            ?
          </div>
        )}
      </div>
      <span className="text-[10px] text-center leading-tight text-slate-700 font-medium line-clamp-2 w-full">
        {team.name}
      </span>
      {taken && <span className="text-[9px] text-red-400 font-medium">Taken</span>}
    </button>
  )
}
