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
    profile = p
    unreadCount = count ?? 0
  }

  return (
    <div className="min-h-screen bg-[#0a1128]">
      <Nav profile={profile} unreadCount={unreadCount} />
      <main className={fullWidth ? '' : 'max-w-7xl mx-auto px-4 py-6'}>
        {children}
      </main>
      <div className="h-20 lg:h-8" /> {/* Bottom spacing for mobile */}
    </div>
  )
}
