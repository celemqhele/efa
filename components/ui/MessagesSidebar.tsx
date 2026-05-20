'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  otherId: string
  otherUsername: string
  latestContent: string | null
  latestTime: string | null
  latestSenderId: string | null
  unreadCount: number
}

interface SearchResult {
  id: string
  username: string
}

interface Props {
  currentUserId: string
  conversations: Conversation[]
}

function timeSince(iso: string | null) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function MessagesSidebar({ currentUserId, conversations }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)

  // Debounced profile search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query.trim()}%`)
        .neq('id', currentUserId)
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, currentUserId])

  async function startConversation(userId: string) {
    setStarting(userId)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: userId }),
    })
    if (res.ok) {
      const { id } = await res.json()
      setQuery('')
      router.push(`/messages/${id}`)
    }
    setStarting(null)
  }

  const isLounge = pathname === '/messages'

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <h2 className="font-black text-slate-900 text-sm mb-2.5">Messages</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users…"
          className="input-field py-2 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim() ? (
          /* Search results */
          <div className="py-1">
            {searching && (
              <p className="px-4 py-3 text-xs text-slate-400">Searching…</p>
            )}
            {!searching && results.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400">No users found for &quot;{query}&quot;</p>
            )}
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => startConversation(u.id)}
                disabled={starting === u.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-light transition-colors text-left border-b border-slate-100"
              >
                <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-sm font-black text-gold shrink-0">
                  {u.username[0]?.toUpperCase() ?? '?'}
                </div>
                <p className="text-sm font-medium text-slate-900 flex-1 min-w-0 truncate">
                  @{u.username}
                </p>
                {starting === u.id ? (
                  <span className="text-xs text-slate-400 shrink-0">Opening…</span>
                ) : (
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Conversation list */
          <>
            {/* EFA Lounge — pinned at top */}
            <Link
              href="/messages"
              className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 transition-colors ${
                isLounge ? 'bg-gold/10 border-l-2 border-l-gold' : 'hover:bg-navy-light'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-base shrink-0">
                🏆
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">EFA Lounge</p>
                <p className="text-xs text-slate-500 truncate">All managers · Group chat</p>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 uppercase tracking-wide font-medium">Group</span>
            </Link>

            {/* DM conversations */}
            {conversations.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-400 text-center leading-relaxed">
                No direct messages yet.<br />Search for a manager above to start chatting.
              </p>
            ) : (
              conversations.map((conv) => {
                const active = pathname === `/messages/${conv.id}`
                return (
                  <Link
                    key={conv.id}
                    href={`/messages/${conv.id}`}
                    className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 transition-colors ${
                      active ? 'bg-gold/10 border-l-2 border-l-gold' : 'hover:bg-navy-light'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-sm font-black text-gold shrink-0">
                      {conv.otherUsername[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-900'}`}>
                          @{conv.otherUsername}
                        </p>
                        {conv.latestTime && (
                          <span className="text-[10px] text-slate-400 shrink-0">{timeSince(conv.latestTime)}</span>
                        )}
                      </div>
                      {conv.latestContent && (
                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {conv.latestSenderId === currentUserId ? 'You: ' : ''}{conv.latestContent}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-gold text-[#0a1128] text-[10px] font-black rounded-full flex items-center justify-center shrink-0">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}
