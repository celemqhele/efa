'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '@/components/ui/BottomSheet'

interface Props {
  userEmail: string
  onClose: () => void
  /**
   * Forced mode for the first-login prompt: the sheet cannot be dismissed
   * (no X, no cancel, backdrop/Escape ignored) and the copy tells the user
   * why. A successful change clears profiles.must_change_password.
   */
  required?: boolean
  /**
   * Forced mode only: do not ask for the "current" password at all.
   *
   * The user is already authenticated as this account, and the only reason the
   * sheet is open is that the platform wants them off a temporary/default
   * password. Asking them to retype it turned a forgotten temp password (or an
   * account flagged in error) into a hard dead end: every attempt came back as
   * "Current password is incorrect" with no way past it. GoTrue's
   * updateUser({ password }) only needs the session, which they have.
   */
  skipCurrentPassword?: boolean
  /** Called after a successful password change (in addition to onClose). */
  onSuccess?: () => void
}

export default function ChangePasswordModal({
  userEmail,
  onClose,
  required = false,
  skipCurrentPassword = false,
  onSuccess,
}: Props) {
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

      // Verify the current password by re-signing in. Skipped in the forced
      // first-login flow (see skipCurrentPassword) — that flow must never be
      // blocked by a password the user was only ever told, not chose.
      if (!skipCurrentPassword) {
        const attempt = async (password: string) =>
          supabase.auth.signInWithPassword({ email: userEmail, password })

        let { error: signInError } = await attempt(currentPassword)
        // A trailing space from a mobile keyboard is the commonest near-miss;
        // retry once with it trimmed before declaring the password wrong.
        const trimmed = currentPassword.trim()
        if (signInError && trimmed && trimmed !== currentPassword) {
          ;({ error: signInError } = await attempt(trimmed))
        }
        if (signInError) {
          const message = signInError.message ?? ''
          const wrongPassword = /invalid login credentials/i.test(message)
          setError(wrongPassword ? 'Current password is incorrect.' : message)
          return
        }
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        setError(updateError.message)
        return
      }

      // Clear the first-login flag (harmless when it is already false). RLS
      // `profiles_update_own` allows a user to update their own row. If this
      // fails the password has still been changed, so do not block the user —
      // log it instead of pretending the change did not happen.
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { error: clearError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id)
        if (clearError) {
          console.error('[change-password] could not clear must_change_password:', clearError.message)
        }
      }

      setSuccess(true)
      onSuccess?.()
      if (required) {
        // No auto-close timer needed in forced mode: the parent unmounts the
        // prompt once the flag is cleared. Still call onClose for the normal
        // profile flow.
        onClose()
      } else {
        setTimeout(onClose, 1500)
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet
      open={true}
      onClose={onClose}
      title={required ? 'Set a new password' : 'Change Password'}
      desktopMaxWidth="max-w-sm"
      dismissible={!required}
    >
      {success ? (
        <div className="py-4 text-center">
          <p className="text-feedback-success font-semibold">Password updated successfully!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {required && (
            <p className="text-text-muted text-xs bg-bg-elevated border border-border rounded-lg px-3 py-2">
              Your account is using a temporary password. Choose your own to continue.
            </p>
          )}
          {!skipCurrentPassword && (
            <div>
              <label className="form-label">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="input-field"
                placeholder="Enter current password"
              />
            </div>
          )}
          <div>
            <label className="form-label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
            {!required && (
              <button type="button" onClick={onClose} className="btn-outline text-sm flex-1">
                Cancel
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-gold text-sm flex-1 disabled:opacity-50">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}
