'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChangePasswordModal from '@/components/ui/ChangePasswordModal'

/**
 * Global forced password prompt.
 *
 * Any account created from now on is stamped `profiles.must_change_password =
 * true` (migration 101) because it starts on the shared default password. On
 * mount — and on every SIGNED_IN — this checks the signed-in user's flag and,
 * if set, blocks the app with a non-dismissible "set a new password" modal
 * until they change it.
 *
 * Mounted in the root layout so it appears wherever the user lands after login
 * (the home page is not under the (protected) group).
 */
export default function FirstLoginPasswordPrompt() {
  const [mustChange, setMustChange] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function check(userId: string, userEmail: string | undefined) {
      const { data } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', userId)
        .maybeSingle()
      if (!active) return
      setMustChange(!!(data as { must_change_password?: boolean } | null)?.must_change_password)
      setEmail(userEmail ?? '')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session?.user) check(data.session.user.id, data.session.user.email ?? undefined)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user) {
        // Defer: awaiting Supabase calls *inside* this callback can deadlock
        // (the callback runs while GoTrue holds its lock). setTimeout(0) hands
        // the work back to a normal tick.
        const { id, email: userEmail } = session.user
        setTimeout(() => { if (active) check(id, userEmail ?? undefined) }, 0)
      } else {
        setMustChange(false)
      }
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
      onClose={() => {}}
      onSuccess={() => setMustChange(false)}
    />
  )
}
