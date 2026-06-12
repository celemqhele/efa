import { createClient } from '@/lib/supabase/server'
import Nav from './Nav'

interface PageWrapperProps {
  children: React.ReactNode
  fullWidth?: boolean
}

export default async function PageWrapper({ children, fullWidth = false }: PageWrapperProps) {
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
    <div className="min-h-screen bg-navy">
      <Nav profile={profile} unreadCount={unreadCount} />
      <main className={fullWidth ? '' : 'max-w-7xl mx-auto px-4 pt-space-8 pb-space-8'}>
        {children}
      </main>
      <div className="h-20 lg:h-8" /> {/* Bottom spacing for mobile */}
    </div>
  )
}

