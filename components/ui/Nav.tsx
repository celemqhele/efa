'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'
import { ViewportSwitch } from './ViewportSwitch'
import NavMobile from './Nav._mobile'
import NavDesktop from './Nav._desktop'

interface NavProps {
  profile?: Profile | null
  unreadCount?: number
}

export default function Nav({ profile, unreadCount = 0 }: NavProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <ViewportSwitch
      mobile={<NavMobile profile={profile} unreadCount={unreadCount} handleLogout={handleLogout} />}
      desktop={<NavDesktop profile={profile} unreadCount={unreadCount} handleLogout={handleLogout} />}
    />
  )
}
