import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ChatWindow from '@/components/ui/ChatWindow'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function ConversationPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load conversation (RLS ensures we can only see our own)
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, participant_1, participant_2')
    .eq('id', params.id)
    .maybeSingle()

  if (!conversation) notFound()

  // Verify user is a participant
  const isParticipant =
    conversation.participant_1 === user.id || conversation.participant_2 === user.id
  if (!isParticipant) notFound()

  const otherId =
    conversation.participant_1 === user.id
      ? conversation.participant_2
      : conversation.participant_1

  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', otherId)
    .single()

  // Load messages
  const { data: messages } = await supabase
    .from('messages')
    .select('id, content, sender_id, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })
    .limit(200)

  // Mark incoming messages as read (server-side, on page open)
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', params.id)
    .neq('sender_id', user.id)
    .is('read_at', null)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
        {/* Back button — visible on mobile only (desktop shows sidebar) */}
        <Link
          href="/messages"
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-gold hover:bg-gold/10 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-sm font-black text-gold shrink-0">
          {otherProfile?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-tight">@{otherProfile?.username ?? 'Unknown'}</p>
          <p className="text-[10px] text-slate-400">EFA Direct Message</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden bg-navy-light">
        <ChatWindow
          conversationId={params.id}
          currentUserId={user.id}
          initialMessages={(messages ?? []) as any[]}
          otherUsername={otherProfile?.username ?? 'Unknown'}
        />
      </div>
    </div>
  )
}
