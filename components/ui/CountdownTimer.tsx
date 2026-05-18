'use client'

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  deadline: string
  label?: string
}

function getTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return null

  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { h, m, s, diff }
}

export default function CountdownTimer({ deadline, label = 'Deadline' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline))

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000)
    return () => clearInterval(interval)
  }, [deadline])

  if (!timeLeft) {
    return <span className="text-xs text-red-400 font-medium">Deadline passed</span>
  }

  const urgent = timeLeft.diff < 3600000 // < 1 hour

  return (
    <div className={`text-xs font-mono ${urgent ? 'text-red-400' : 'text-[#c9a84c]'}`}>
      <span className="text-slate-500 mr-1">{label}:</span>
      {String(timeLeft.h).padStart(2, '0')}:{String(timeLeft.m).padStart(2, '0')}:{String(timeLeft.s).padStart(2, '0')}
      {urgent && <span className="ml-1 animate-pulse">⚠️</span>}
    </div>
  )
}
