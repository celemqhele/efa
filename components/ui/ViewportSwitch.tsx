'use client'

import { useViewport } from '@/hooks/useViewport'
import type { Viewport } from '@/hooks/useViewport'

interface Props {
  mobile: React.ReactNode
  desktop: React.ReactNode
  fallback?: React.ReactNode
}

export function ViewportSwitch({ mobile, desktop, fallback }: Props) {
  const viewport: Viewport = useViewport()

  if (viewport === 'mobile') return <>{mobile}</>
  return <>{desktop}</>
}
