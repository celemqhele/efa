'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const SWIPE_THRESHOLD = 60
const DRAG_LOCK = 4

interface SwipeCardStackProps<T> {
  items: T[]
  renderCard: (item: T, index: number) => ReactNode
  empty?: ReactNode
  minH?: string
  className?: string
}

export default function SwipeCardStack<T>({
  items,
  renderCard,
  empty,
  minH = 'min-h-[240px]',
  className = '',
}: SwipeCardStackProps<T>) {
  const count = items.length
  const [top, setTop] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const startYRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (count > 0 && top >= count) setTop(0)
  }, [count, top])

  useEffect(() => {
    const el = containerRef.current
    if (!el || count < 2) return

    function onTouchStart(e: TouchEvent) {
      if (busyRef.current) return
      startYRef.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (busyRef.current || startYRef.current == null) return
      const dy = e.touches[0].clientY - startYRef.current
      if (Math.abs(dy) > DRAG_LOCK) {
        setDragging(true)
        setDragY(dy)
        e.preventDefault()
        e.stopPropagation()
      }
    }

    function finishSwipe(dy: number) {
      const h = containerRef.current?.clientHeight ?? 240
      busyRef.current = true
      setDragging(false)
      if (dy <= -SWIPE_THRESHOLD) {
        setLeaving(true)
        setDragY(-(h + 80))
        window.setTimeout(() => {
          setTop((t) => (t + 1) % count)
          setDragY(0)
          setLeaving(false)
          busyRef.current = false
        }, 300)
      } else if (dy >= SWIPE_THRESHOLD) {
        setLeaving(true)
        setDragY(h + 80)
        window.setTimeout(() => {
          setTop((t) => (t - 1 + count) % count)
          setDragY(0)
          setLeaving(false)
          busyRef.current = false
        }, 300)
      } else {
        setDragY(0)
        busyRef.current = false
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (startYRef.current == null) return
      const dy = e.changedTouches[0].clientY - startYRef.current
      startYRef.current = null
      finishSwipe(dy)
    }

    el.addEventListener('touchstart', onTouchStart)
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [count])

  if (count === 0) return <>{empty}</>
  if (count === 1) return <div className={`${minH} ${className}`}>{renderCard(items[0], 0)}</div>

  const offsets = leaving ? [0] : [0, 1, 2]

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-[10px] text-text-muted px-1 pb-1.5">
        <span className="font-medium">Swipe up / down</span>
        <span className="font-bold tabular-nums">{(top % count) + 1} / {count}</span>
      </div>

      <div ref={containerRef} className={`relative touch-none overflow-hidden ${minH}`}>
        {offsets.map((offset) => {
          const idx = (top + offset) % count
          const isTop = offset === 0
          const transform = isTop
            ? `translateY(${dragY}px) rotate(${dragY * 0.04}deg)`
            : `translateY(${offset * 11}px) scale(${1 - offset * 0.03})`
          return (
            <div
              key={idx}
              className={isTop ? 'relative' : 'absolute inset-x-0 top-0'}
              style={{
                zIndex: isTop ? 30 : 30 - offset,
                transform,
                transformOrigin: 'center top',
                opacity: !isTop ? 1 - offset * 0.3 : 1,
                transition: !isTop
                  ? 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : isTop && dragging
                    ? 'none'
                    : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {renderCard(items[idx], idx)}
            </div>
          )
        })}
      </div>
    </div>
  )
}