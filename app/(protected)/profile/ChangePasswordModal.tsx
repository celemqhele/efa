'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '@/components/ui/BottomSheet'

interface Props {
  userEmail: string
  onClose: () => void
}

export default function ChangePasswordModal({ userEmail, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // Verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      })
      if (signInError) {
        setError('Current password is incorrect.')
        return
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={true} onClose={onClose} title="Change Password" desktopMaxWidth="max-w-sm">
      {success ? (
        <div className="py-4 text-center">
          <p className="text-feedback-success font-semibold">Password updated successfully!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="input-field"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="form-label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="input-field"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input-field"
              placeholder="Repeat new password"
            />
          </div>

          {error && (
            <p className="text-feedback-error text-sm bg-feedback-error/10 border border-feedback-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-outline text-sm flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-gold text-sm flex-1 disabled:opacity-50">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}

