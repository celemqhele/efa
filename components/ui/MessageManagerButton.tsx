'use client'

import { useState } from 'react'
import { Button } from './Button'
import { X } from 'lucide-react'

interface Props {
  managerId: string
  managerUsername: string
  managerPhone?: string | null
}

export default function MessageManagerButton({ managerId: _managerId, managerUsername, managerPhone }: Props) {
  const [showPopup, setShowPopup] = useState(false)

  const handleClick = () => {
    if (managerPhone) {
      const cleaned = managerPhone.replace(/\D/g, '')
      if (cleaned) {
        window.open(`https://wa.me/${cleaned}`, '_blank', 'noopener,noreferrer')
        return
      }
    }
    setShowPopup(true)
  }

  const phoneAvailable = managerPhone && managerPhone.replace(/\D/g, '').length > 0

  return (
    <>
      <Button
        onClick={handleClick}
        variant="secondary"
        className="text-xs flex items-center gap-space-1"
      >
        <svg className="w-space-3 h-space-3" fill="none" viewBox="0 0 24 24">
          {phoneAvailable ? (
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 21l1.65-3.8a9 9 0 113.4 2.9L3 21" />
          ) : (
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          )}
        </svg>
        {phoneAvailable ? `Chat @${managerUsername}` : `Message @${managerUsername}`}
      </Button>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPopup(false)}>
          <div
            className="bg-bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground-primary">No Phone Number</h3>
              <button
                onClick={() => setShowPopup(false)}
                className="p-1 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <p className="text-sm text-text-muted mb-2">
              <strong className="text-foreground-primary">@{managerUsername}</strong> has not added their phone number to their profile.
            </p>
            <p className="text-xs text-text-muted">
              Contact an admin for assistance with reaching this manager.
            </p>
            <button
              onClick={() => setShowPopup(false)}
              className="mt-5 w-full px-4 py-2 bg-gold text-navy text-sm font-bold rounded-lg hover:bg-gold-light transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
