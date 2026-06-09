'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { format, parseISO, addDays } from 'date-fns'

interface Props {
  currentDate: string  // YYYY-MM-DD
  todayKey: string     // YYYY-MM-DD
  basePath: string     // e.g. "/fixtures" or "/admin/fixtures/manage"
}

export default function DateNav({ currentDate, todayKey, basePath }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const date = parseISO(currentDate)
  const prevKey = format(addDays(date, -1), 'yyyy-MM-dd')
  const nextKey = format(addDays(date, 1), 'yyyy-MM-dd')
  const isToday = currentDate === todayKey

  function goto(key: string) {
    router.push(`${basePath}?date=${key}`)
  }

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.click()
      input.focus()
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => goto(prevKey)}
        className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-accent/50 hover:text-accent transition-colors"
        aria-label="Previous day"
      >
        ←
      </button>

      <div className="flex items-center gap-2 flex-1 justify-center">
        <button
          type="button"
          onClick={openPicker}
          className="text-center hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.03]"
        >
          <span className="block text-base font-bold text-slate-900">
            {format(date, 'EEEE')}
          </span>
          <span className="block text-xs text-slate-500">
            {format(date, 'd MMM yyyy')}
          </span>
        </button>
        <input
          ref={inputRef}
          type="date"
          value={currentDate}
          onChange={(e) => goto(e.target.value)}
          className="sr-only"
          aria-label="Pick a date"
        />
        {!isToday && (
          <button
            type="button"
            onClick={() => goto(todayKey)}
            className="ml-1 px-2 py-1 text-[10px] font-bold rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors uppercase tracking-wider"
          >
            Today
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => goto(nextKey)}
        className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-accent/50 hover:text-accent transition-colors"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  )
}

