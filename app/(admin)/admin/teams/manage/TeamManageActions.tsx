'use client'

import { useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import BatchPostponeModal from './BatchPostponeModal'

interface Props {
  teamId: string
  teamName: string
  managerId: string | null
  managerName: string | null
}

export default function TeamManageActions({ teamId, teamName, managerId, managerName }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mgr, setMgr] = useState(managerId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [postponeOpen, setPostponeOpen] = useState(false)

  async function handleRemoveManager() {
    setDialogOpen(false)
    setLoading('remove')
    setError('')
    try {
      const res = await fetch('/api/admin/sack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      setMgr(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={dialogOpen}
        title="Remove Manager"
        message={`Remove "${managerName}" as manager of "${teamName}"? Their stats will be sealed.`}
        confirmLabel="Remove"
        danger
        onConfirm={handleRemoveManager}
        onCancel={() => setDialogOpen(false)}
      />

      {postponeOpen && (
        <BatchPostponeModal
          teamId={teamId}
          teamName={teamName}
          onClose={() => setPostponeOpen(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {mgr && (
          <button
            onClick={() => setDialogOpen(true)}
            disabled={loading === 'remove'}
            className="btn-danger text-xs py-1 px-2.5"
          >
            {loading === 'remove' ? '...' : 'Remove Manager'}
          </button>
        )}
        <button
          onClick={() => setPostponeOpen(true)}
          className="text-xs py-1 px-2.5 rounded border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors"
        >
          Batch Postpone
        </button>
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </div>
    </>
  )
}
