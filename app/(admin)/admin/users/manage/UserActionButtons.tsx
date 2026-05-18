'use client'

import { useState } from 'react'

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
  const [hasteam, setHasTeam] = useState(!!teamId)

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
    const confirmed = confirm(
      `${newRole === 'admin' ? 'Grant admin role to' : 'Remove admin from'} "${username}"?`
    )
    if (!confirmed) return
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
    if (!teamId) return
    const confirmed = confirm(`Remove "${username}" as manager of "${teamName}"?`)
    if (!confirmed) return
    setLoading('sack')
    try {
      await postAction('/api/admin/sack', { userId: profileId, teamId })
      setHasTeam(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasteam && teamId && (
        <button
          onClick={handleSack}
          disabled={loading === 'sack'}
          className="btn-danger text-xs py-1 px-2.5"
        >
          {loading === 'sack' ? '...' : 'Sack'}
        </button>
      )}
      <button
        onClick={handleRoleToggle}
        disabled={loading === 'role'}
        className={`text-xs py-1 px-2.5 rounded-lg border font-medium transition-colors ${
          role === 'admin'
            ? 'text-orange-400 border-orange-400/30 bg-orange-400/10 hover:bg-orange-400/20'
            : 'text-blue-400 border-blue-400/30 bg-blue-400/10 hover:bg-blue-400/20'
        }`}
      >
        {loading === 'role' ? '...' : role === 'admin' ? 'Remove Admin' : 'Make Admin'}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
