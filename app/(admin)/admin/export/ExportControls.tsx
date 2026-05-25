'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Tournament {
  id: string
  name: string
  type: string
}

interface Props {
  tournaments: Tournament[]
  defaultDate: string
  defaultTournamentIds: string[]
  defaultTypes: string[]
}

const TYPE_OPTIONS = ['fixtures', 'results', 'standings'] as const
type ExportType = (typeof TYPE_OPTIONS)[number]

export default function ExportControls({
  tournaments,
  defaultDate,
  defaultTournamentIds,
  defaultTypes,
}: Props) {
  const [date, setDate] = useState(defaultDate)
  const [tournamentIds, setTournamentIds] = useState<string[]>(defaultTournamentIds)
  const [types, setTypes] = useState<string[]>(defaultTypes)
  const router = useRouter()

  function toggleTournament(id: string) {
    setTournamentIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  function toggleType(t: ExportType) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  const allSelected = TYPE_OPTIONS.every((t) => types.includes(t))

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!date || tournamentIds.length === 0 || types.length === 0) return
    const params = new URLSearchParams({
      date,
      tournaments: tournamentIds.join(','),
      types: types.join(','),
    })
    router.push(`/admin/export?${params}`)
  }

  return (
    <form onSubmit={handleGenerate} className="card p-5 space-y-5">
      {/* Date */}
      <div>
        <label className="form-label block mb-1.5">Select Day</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-field"
          required
        />
        <p className="text-slate-500 text-xs mt-1">Applies to fixtures and results. Standings always reflect the current full table.</p>
      </div>

      {/* League */}
      <div>
        <label className="form-label block mb-2">League</label>
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTournament(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                tournamentIds.includes(t.id)
                  ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                  : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content type */}
      <div>
        <label className="form-label block mb-2">Content</label>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                types.includes(t)
                  ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                  : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTypes(allSelected ? [] : [...TYPE_OPTIONS])}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              allSelected
                ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={!date || tournamentIds.length === 0 || types.length === 0}
        className="w-full py-2.5 bg-[#c9a84c] text-[#0a1128] font-bold rounded-lg hover:bg-[#e0c06a] transition-colors disabled:opacity-40 text-sm"
      >
        Generate
      </button>
    </form>
  )
}
