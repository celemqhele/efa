export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Shell from './_shell'

export const revalidate = 0

export default async function NotificationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as any

  const isAdmin = profile?.role === 'admin'

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const allNotifications = (notifications ?? []) as Array<{
    id: string
    type: string
    title: string
    body: string
    read: boolean
    created_at: string
    data: any
  }>

  const { data: pendingRequests } = isAdmin
    ? await supabase
        .from('team_change_requests')
        .select(`
          id, created_at,
          requesting_user:profiles!team_change_requests_requesting_user_id_fkey(username),
          current_team:teams!team_change_requests_current_team_id_fkey(name),
          requested_team:teams!team_change_requests_requested_team_id_fkey(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
    : { data: null }

  return <Shell data={{ allNotifications, pendingRequests, isAdmin }} />
}
