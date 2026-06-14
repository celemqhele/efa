'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'

export default function MobileGestures() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const pullingRef = useRef(false)
  const pullDistRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isMobile) return

    const PULL_THRESHOLD = 80
    const SWIPE_THRESHOLD = 80

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!touchStartRef.current) return
      const touch = e.touches[0]
      const dy = touch.clientY - touchStartRef.current.y
      const dx = touch.clientX - touchStartRef.current.x

      // Swipe-back from left edge — prevent default to avoid conflict with scroll
      if (touchStartRef.current.x < 30 && dx > 30 && Math.abs(dy) < 60) {
        e.preventDefault()
        return
      }

      // Pull-to-refresh — only when at top of page
      if (window.scrollY <= 5 && dy > 0) {
        pullingRef.current = true
        const clamped = Math.min(dy * 0.4, 100)
        pullDistRef.current = clamped
        setPullDistance(clamped)
        if (clamped > 5) {
          e.preventDefault()
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStartRef.current) {
        touchStartRef.current = null
        return
      }

      const startX = touchStartRef.current.x
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dt = Date.now() - touchStartRef.current.time

      // Swipe-back from left edge
      if (startX < 30 && dx > SWIPE_THRESHOLD && dt < 400) {
        touchStartRef.current = null
        router.back()
        return
      }

      // Pull-to-refresh
      if (pullingRef.current && pullDistRef.current >= PULL_THRESHOLD) {
        setRefreshing(true)
        setPullDistance(0)
        pullingRef.current = false
        pullDistRef.current = 0
        touchStartRef.current = null
        window.location.reload()
        return
      }

      setPullDistance(0)
      pullDistRef.current = 0
      pullingRef.current = false
      touchStartRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, router])

  if (!isMobile) return null

  return (
    <>
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none transition-opacity"
          style={{ height: pullDistance + 20 }}
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin"
            style={{ opacity: Math.min(pullDistance / 50, 1) }}
          />
        </div>
      )}

      {refreshing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-base/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="text-sm text-text-secondary font-medium">Refreshing…</p>
          </div>
        </div>
      )}
    </>
  )
}
