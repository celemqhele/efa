export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Shell from './_shell'

export const revalidate = 0

export default async function AdminNotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: pendingRequests },
    { data: adminNotifications },
    { data: allUsers },
  ] = await Promise.all([
    supabase
      .from('team_change_requests')
      .select(`
        id, status, created_at,
        requesting_user:profiles!team_change_requests_requesting_user_id_fkey (username, avatar_url),
        current_team:teams!team_change_requests_current_team_id_fkey (name, logo_league_folder, logo_team_slug),
        requested_team:teams!team_change_requests_requested_team_id_fkey (name, logo_league_folder, logo_team_slug)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, username')
      .order('username'),
  ])

  return (
    <Shell data={{
      pendingRequests: (pendingRequests ?? []) as any[],
      notifications: (adminNotifications ?? []) as any[],
      allUsers: (allUsers ?? []) as any[],
    }} />
  )
}

