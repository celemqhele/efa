'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function DeleteTournamentButton({ tournamentId, tournamentName }: {
  tournamentId: string
  tournamentName: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delete-tournament', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const { error } = await res.json()
        console.error(`Failed to delete: ${error}`)
      }
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        className="text-xs flex-1"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>

      <ConfirmDialog
        open={open}
        title="Delete Tournament?"
        message={`Are you sure you want to delete "${tournamentName}"? This action cannot be undone.`}
        confirmLabel={loading ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}


