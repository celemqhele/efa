'use client'

import { Button } from './Button'
import BottomSheet from './BottomSheet'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onCancel}>
      <h3 className="text-text-primary font-bold text-lg mb-2">{title}</h3>
      <p className="text-text-secondary text-sm mb-6 leading-relaxed">{message}</p>
      <div className="flex gap-space-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? 'destructive' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}

