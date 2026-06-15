'use client'

import { useState, useEffect } from 'react'

export type Viewport = 'mobile' | 'desktop'

const MOBILE_BREAKPOINT = 1024

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>('desktop')

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    setViewport(mq.matches ? 'mobile' : 'desktop')

    function handler(e: MediaQueryListEvent) {
      setViewport(e.matches ? 'mobile' : 'desktop')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return viewport
}
