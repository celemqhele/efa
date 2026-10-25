'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChangePasswordModal from '@/components/ui/ChangePasswordModal'

/**
 * Global forced password prompt.
 *
 * The user is asked to set a new password when either:
 *   - `profiles.must_change_password` is true (every new account, via the
 *     migration 101 column default; also an admin override), OR
 *   - `password_is_default()` returns true (migration 102) — an exact check for
 *     any account still sitting on the shared default password, which catches
 *     pre-update accounts and accounts reset back to the default.
 *
 * On mount — and on every SIGNED_IN — this checks the signed-in user and, if
 * either is true, blocks the app with a non-dismissible "set a new password"
 * modal until they change it.
 *
 * Mounted in the root layout so it appears wherever the user lands after login
 * (the home page is not under the (protected) group).
 */
export default function FirstLoginPasswordPrompt() {
  const [mustChange, setMustChange] = useState(false)
  const [email, setEmail] = useState('')
  // Password just changed: any check that was already in flight read the flag
  // as it was *before* the change and would re-open the prompt. Ignore those.
  const clearedAt = useRef(0)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function check(userId: string, userEmail: string | undefined) {
      const [profileRes, defaultRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('must_change_password')
          .eq('id', userId)
          .maybeSingle(),
        supabase.rpc('password_is_default'),
      ])
      if (!active) return
      if (Date.now() - clearedAt.current < 10_000) return
      const flagged = !!(profileRes.data as { must_change_password?: boolean } | null)
        ?.must_change_password
      setMustChange(flagged || defaultRes.data === true)
      setEmail(userEmail ?? '')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session?.user) check(data.session.user.id, data.session.user.email ?? undefined)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      // Only genuine sign-ins need the check. USER_UPDATED fires from our own
      // password change and used to re-open the prompt with a pre-change read;
      // TOKEN_REFRESHED would only re-run the same query for nothing.
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') {
        if (!session?.user) {
          setMustChange(false)
          setEmail('')
        }
        return
      }
      if (!session?.user) {
        setMustChange(false)
        return
      }
      // Defer: awaiting Supabase calls *inside* this callback can deadlock
      // (the callback runs while GoTrue holds its lock). setTimeout(0) hands
      // the work back to a normal tick.
      const { id, email: userEmail } = session.user
      setTimeout(() => { if (active) check(id, userEmail ?? undefined) }, 0)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!mustChange) return null

  return (
    <ChangePasswordModal
      userEmail={email}
      required
      skipCurrentPassword
      onClose={() => {}}
      onSuccess={() => {
        clearedAt.current = Date.now()
        setMustChange(false)
      }}
    />
  )
}
