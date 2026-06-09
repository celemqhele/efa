'use client'

import { useRouter } from 'next/navigation'

const TYPE_DOT: Record<string, string> = {
  league: 'bg-blue-400',
  ucl: 'bg-accent',
  europa: 'bg-orange-400',
  super_cup: 'bg-purple-400',
}

interface Props {
  tournaments: { id: string; name: string; type: string }[]
  selectedId: string
}

export default function StandingsSwitcher({ tournaments, selectedId }: Props) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-slate-500 shrink-0">Competition</label>
      <div className="relative max-w-xs w-full">
        <select
          value={selectedId}
          onChange={(e) => router.push(`/standings?t=${e.target.value}`)}
          className="input-field pr-8 appearance-none cursor-pointer"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          ▾
        </div>
      </div>
    </div>
  )
}

