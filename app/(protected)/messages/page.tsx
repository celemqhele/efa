import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoungeChat from '@/components/ui/LoungeChat'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, channelRes] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    supabase.from('channels').select('id, name, description').eq('name', 'EFA Lounge').single(),
  ])

  const profile = profileRes.data
  const channel = channelRes.data

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-4xl mb-3">🏆</p>
        <p className="font-semibold text-slate-900 mb-1">EFA Lounge not set up yet</p>
        <p className="text-slate-500 text-sm">Ask an admin to run the channels migration.</p>
      </div>
    )
  }

  const [messagesRes, memberCountRes] = await Promise.all([
    supabase
      .from('channel_messages')
      .select('id, channel_id, sender_id, content, gif_url, created_at, sender:profiles!channel_messages_sender_id_fkey(username, avatar_url)')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: true })
      .limit(100),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const messages = (messagesRes.data ?? []).map((m: any) => ({
    ...m,
    sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
  }))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-base shrink-0">
          🏆
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm leading-tight">{channel.name}</p>
          <p className="text-xs text-slate-500 truncate">{channel.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold text-green-500">{memberCountRes.count ?? 0} members</p>
          <p className="text-[10px] text-slate-400">All EFA managers</p>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <LoungeChat
          channelId={channel.id}
          currentUserId={user.id}
          currentUsername={profile?.username ?? 'You'}
          initialMessages={messages}
        />
      </div>
    </div>
  )
}
