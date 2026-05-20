import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoungeChat from '@/components/ui/LoungeChat'

export const dynamic = 'force-dynamic'

export default async function LoungePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // Get the EFA Lounge channel
  const { data: channel } = await supabase
    .from('channels')
    .select('id, name, description')
    .eq('name', 'EFA Lounge')
    .single()

  if (!channel) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <p className="text-slate-400">Lounge not configured yet. Run the SQL migration first.</p>
        </div>
      </div>
    )
  }

  // Load last 100 messages with sender profiles
  const { data: messages } = await supabase
    .from('channel_messages')
    .select('id, channel_id, sender_id, content, gif_url, created_at, sender:profiles!channel_messages_sender_id_fkey(username, avatar_url)')
    .eq('channel_id', channel.id)
    .order('created_at', { ascending: true })
    .limit(100)

  // Count members online (anyone with a push subscription — rough proxy)
  const { count: memberCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="card p-4 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-lg shrink-0">
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-slate-900">{channel.name}</h1>
            <p className="text-xs text-slate-400">{channel.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-green-400">{memberCount ?? 0} members</p>
            <p className="text-[10px] text-slate-500">All EFA managers</p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="card flex-1 overflow-hidden">
        <LoungeChat
          channelId={channel.id}
          currentUserId={user.id}
          currentUsername={profile?.username ?? 'You'}
          initialMessages={(messages ?? []).map((m: any) => ({
            ...m,
            sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
          }))}
        />
      </div>
    </div>
  )
}
