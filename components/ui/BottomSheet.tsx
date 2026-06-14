'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Override the default max-width on desktop (default: max-w-md) */
  desktopMaxWidth?: string
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  desktopMaxWidth = 'max-w-md',
}: BottomSheetProps) {
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  // Desktop: centered modal
  if (!isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div
          className={`relative z-10 w-full ${desktopMaxWidth} bg-bg-surface border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-fast`}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className={title ? '' : 'p-6'}>{children}</div>
        </div>
      </div>
    )
  }

  // Mobile: bottom sheet
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div
        className="absolute bottom-0 inset-x-0 bg-bg-surface rounded-t-2xl border-t border-border shadow-xl animate-in slide-in-from-bottom duration-300"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 sticky top-0 bg-bg-surface z-10">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>

        {title && (
          <div className="flex items-center justify-between px-6 pb-3 pt-1">
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className={title ? 'px-6 pb-8' : 'p-6 pb-8'}>{children}</div>
      </div>
    </div>
  )
}
