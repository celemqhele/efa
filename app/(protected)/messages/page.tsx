import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // All conversations for this user
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, participant_1, participant_2, last_message_at')
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order('last_message_at', { ascending: false })

  const convList = conversations ?? []

  // Load other participants' profiles
  const otherIds = Array.from(new Set(
    convList.map((c: any) => c.participant_1 === user.id ? c.participant_2 : c.participant_1)
  )) as string[]

  const { data: profiles } = otherIds.length > 0
    ? await supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds)
    : { data: [] as any[] }

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  // Latest message per conversation (for preview)
  const convIds = convList.map((c: any) => c.id)
  const { data: latestMsgs } = convIds.length > 0
    ? await supabase
        .from('messages')
        .select('conversation_id, content, sender_id, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const latestMap = new Map<string, any>()
  for (const m of latestMsgs ?? []) {
    if (!latestMap.has(m.conversation_id)) latestMap.set(m.conversation_id, m)
  }

  // Unread count per conversation
  const { data: unreadRows } = convIds.length > 0
    ? await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .is('read_at', null)
    : { data: [] as any[] }

  const unreadCountMap = new Map<string, number>()
  for (const r of unreadRows ?? []) {
    unreadCountMap.set(r.conversation_id, (unreadCountMap.get(r.conversation_id) ?? 0) + 1)
  }

  function timeSince(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-slate-900">Messages</h1>
        <p className="text-xs text-slate-400">
          Use messages to arrange matchrooms &amp; share room codes
        </p>
      </div>

      {convList.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-3">💬</p>
          <p className="font-semibold text-slate-900 mb-1">No conversations yet</p>
          <p className="text-slate-400 text-sm">
            Go to any club page and click <strong>Message Manager</strong> to start a chat.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-navy-border">
            {convList.map((conv: any) => {
              const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1
              const other = profileMap.get(otherId)
              const latest = latestMap.get(conv.id)
              const unread = unreadCountMap.get(conv.id) ?? 0

              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-navy-light transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-sm font-black text-gold shrink-0">
                    {other?.username?.[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Name + preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-900'}`}>
                        @{other?.username ?? 'Unknown'}
                      </p>
                    </div>
                    {latest && (
                      <p className={`text-xs truncate ${unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                        {latest.sender_id === user.id ? 'You: ' : ''}{latest.content}
                      </p>
                    )}
                  </div>

                  {/* Time + unread badge */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {latest && (
                      <p className="text-[10px] text-slate-400">{timeSince(latest.created_at)}</p>
                    )}
                    {unread > 0 && (
                      <span className="w-5 h-5 bg-gold text-[#0a1128] text-[10px] font-black rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
