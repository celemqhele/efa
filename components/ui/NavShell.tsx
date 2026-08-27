import { createClient } from '@/lib/supabase/server'
import Nav from './Nav'
import BottomTabBar from './BottomTabBar'

export default async function NavShell() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let unreadCount = 0

  if (user) {
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('notifications').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('read', false),
    ])
    unreadCount = count ?? 0

    // If the profile row doesn't exist yet (DB trigger timing / pre-team-selection),
    // synthesize a minimal stub from session metadata so the nav shows logged-in state.
    profile = p ?? {
      id: user.id,
      username: (user.user_metadata?.username as string | undefined)
        ?? user.email?.split('@')[0]
        ?? 'user',
      role: 'user' as const,
      avatar_url: null,
      playstyle: null,
      created_at: user.created_at ?? new Date().toISOString(),
    }
  }

  return (
    <>
      <Nav profile={profile} unreadCount={unreadCount} />
      <BottomTabBar profile={profile} unreadCount={unreadCount} />
    </>
  )
}