'use client'

import BottomSheet from './BottomSheet'
import { Button } from './Button'

interface Props {
  open: boolean
  username: string
  cooldownEndsAt: string
  onClose: () => void
}

export default function SackCooldownDialog({ open, username, cooldownEndsAt, onClose }: Props) {
  const date = new Date(cooldownEndsAt)
  const formatted = isNaN(date.getTime())
    ? cooldownEndsAt
    : date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className="text-text-primary font-bold text-lg mb-2">Manager in Cooldown</h3>
      <p className="text-text-secondary text-sm mb-6 leading-relaxed">
        @{username} was recently sacked. You can reassign them starting{' '}
        <span className="font-semibold text-text-primary">{formatted}</span>.
      </p>
      <div className="flex gap-space-2 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Got it
        </Button>
      </div>
    </BottomSheet>
  )
}
