'use client'

import { useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Props {
  profileId: string
  username: string
  currentRole: string
  teamId: string | null
  teamName: string | null
}

export default function UserActionButtons({ profileId, username, currentRole, teamId, teamName }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [role, setRole] = useState(currentRole)
  const [hasTeam, setHasTeam] = useState(!!teamId)
  const [dialog, setDialog] = useState<'sack' | 'role' | 'reset-password' | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  async function postAction(endpoint: string, body: object) {
    setError('')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Action failed')
    return data
  }

  async function handleRoleToggle() {
    const newRole = role === 'admin' ? 'user' : 'admin'
    setDialog(null)
    setLoading('role')
    try {
      await postAction('/api/admin/role', { userId: profileId, role: newRole })
      setRole(newRole)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleSack() {
    setDialog(null)
    setLoading('sack')
    try {
      await postAction('/api/admin/sack', { teamId })
      setHasTeam(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleResetPassword() {
    setDialog(null)
    setLoading('reset-password')
    setResetSuccess(false)
    try {
      await postAction('/api/admin/reset-password', { user_id: profileId })
      setResetSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const newRole = role === 'admin' ? 'user' : 'admin'

  return (
    <>
      <ConfirmDialog
        open={dialog === 'sack'}
        title="Sack Manager"
        message={`Remove "${username}" as manager of "${teamName}"? Their stats will be sealed.`}
        confirmLabel="Sack"
        danger
        onConfirm={handleSack}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'role'}
        title={newRole === 'admin' ? 'Grant Admin' : 'Remove Admin'}
        message={
          newRole === 'admin'
            ? `Give "${username}" full admin access to the platform?`
            : `Remove admin access from "${username}"?`
        }
        confirmLabel={newRole === 'admin' ? 'Grant' : 'Remove'}
        danger={newRole !== 'admin'}
        onConfirm={handleRoleToggle}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'reset-password'}
        title="Reset Password"
        message={`Reset "${username}"'s password to the default? They should change it after logging in.`}
        confirmLabel="Reset"
        onConfirm={handleResetPassword}
        onCancel={() => setDialog(null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {hasTeam && teamId && (
          <button
            onClick={() => setDialog('sack')}
            disabled={loading === 'sack'}
            className="btn-danger text-xs py-1 px-2.5"
          >
            {loading === 'sack' ? '...' : 'Sack'}
          </button>
        )}
        <button
          onClick={() => setDialog('role')}
          disabled={loading === 'role'}
          className={`text-xs py-1 px-2.5 rounded-lg border font-medium transition-colors ${
            role === 'admin'
              ? 'text-orange-400 border-orange-400/30 bg-orange-400/10 hover:bg-orange-400/20'
              : 'text-blue-400 border-blue-400/30 bg-blue-400/10 hover:bg-blue-400/20'
          }`}
        >
          {loading === 'role' ? '...' : role === 'admin' ? 'Remove Admin' : 'Make Admin'}
        </button>
        <button
          onClick={() => { setResetSuccess(false); setDialog('reset-password') }}
          disabled={loading === 'reset-password'}
          className="text-xs py-1 px-2.5 rounded-lg border font-medium transition-colors text-violet-400 border-violet-400/30 bg-violet-400/10 hover:bg-violet-400/20"
        >
          {loading === 'reset-password' ? '...' : 'Reset Password'}
        </button>
        {error && <span className="text-red-400 text-xs">{error}</span>}
        {resetSuccess && (
          <span className="text-green-400 text-xs">Password reset — remind them to change it</span>
        )}
      </div>
    </>
  )
}

