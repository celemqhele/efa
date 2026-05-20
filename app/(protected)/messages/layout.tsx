import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessagesShell from '@/components/ui/MessagesShell'
import MessagesSidebar from '@/components/ui/MessagesSidebar'

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch conversations for sidebar
  const { data: convRows } = await supabase
    .from('conversations')
    .select('id, participant_1, participant_2, created_at')
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const convList = convRows ?? []
  const convIds = convList.map((c: any) => c.id)
  const otherIds = Array.from(new Set(
    convList.map((c: any) =>
      c.participant_1 === user.id ? c.participant_2 : c.participant_1
    )
  )) as string[]

  const [profilesRes, latestMsgsRes, unreadRes] = await Promise.all([
    otherIds.length > 0
      ? supabase.from('profiles').select('id, username').in('id', otherIds)
      : Promise.resolve({ data: [] as any[] }),
    convIds.length > 0
      ? supabase.from('messages')
          .select('conversation_id, content, sender_id, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    convIds.length > 0
      ? supabase.from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .neq('sender_id', user.id)
          .is('read_at', null)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]))

  const latestMap = new Map<string, any>()
  for (const m of latestMsgsRes.data ?? []) {
    if (!latestMap.has(m.conversation_id)) latestMap.set(m.conversation_id, m)
  }

  const unreadCountMap = new Map<string, number>()
  for (const r of unreadRes.data ?? []) {
    unreadCountMap.set(r.conversation_id, (unreadCountMap.get(r.conversation_id) ?? 0) + 1)
  }

  const conversations = convList.map((c: any) => {
    const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1
    const other = profileMap.get(otherId)
    const latest = latestMap.get(c.id)
    return {
      id: c.id,
      otherId,
      otherUsername: other?.username ?? 'Unknown',
      latestContent: latest?.content ?? null,
      latestTime: latest?.created_at ?? null,
      latestSenderId: latest?.sender_id ?? null,
      unreadCount: unreadCountMap.get(c.id) ?? 0,
    }
  })

  const sidebar = (
    <MessagesSidebar
      currentUserId={user.id}
      conversations={conversations}
    />
  )

  return (
    // Fixed layer that covers viewport below the nav (h-14 = 3.5rem)
    <div className="fixed inset-x-0 bottom-0 overflow-hidden" style={{ top: '3.5rem' }}>
      <MessagesShell sidebar={sidebar}>
        {children}
      </MessagesShell>
    </div>
  )
}
