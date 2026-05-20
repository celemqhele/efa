'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import GifPicker from './GifPicker'

interface ChannelMessage {
  id: string
  channel_id: string
  sender_id: string
  content: string | null
  gif_url: string | null
  created_at: string
  sender?: { username: string; avatar_url: string | null }
}

interface Props {
  channelId: string
  currentUserId: string
  currentUsername: string
  initialMessages: ChannelMessage[]
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function LoungeChat({ channelId, currentUserId, currentUsername, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChannelMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showGif, setShowGif] = useState(false)
  // Cache of sender profiles
  const [profileCache, setProfileCache] = useState<Map<string, { username: string; avatar_url: string | null }>>(
    () => new Map(initialMessages.map((m) => [m.sender_id, m.sender ?? { username: 'Unknown', avatar_url: null }]))
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`lounge:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const msg = payload.new as ChannelMessage
          if (messages.some((m) => m.id === msg.id)) return

          // Fetch sender profile if not cached
          let sender = profileCache.get(msg.sender_id)
          if (!sender) {
            const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', msg.sender_id).single()
            sender = data ?? { username: 'Unknown', avatar_url: null }
            setProfileCache((prev) => new Map(prev).set(msg.sender_id, sender!))
          }

          setMessages((prev) => [...prev, { ...msg, sender }])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  const send = async (opts?: { content?: string; gif_url?: string }) => {
    const content = opts?.content ?? input.trim()
    const gif_url = opts?.gif_url
    if (!content && !gif_url) return
    if (sending) return

    setSending(true)
    if (!gif_url) setInput('')

    await fetch('/api/lounge/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, content: content || null, gif_url }),
    })

    setSending(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-10">
            No messages yet — be the first in the EFA Lounge! 🏆
          </p>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId
          const senderName = isMe ? currentUsername : (msg.sender?.username ?? 'Unknown')

          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-xs font-black text-gold shrink-0 mt-0.5">
                {senderName[0]?.toUpperCase() ?? '?'}
              </div>

              <div className={`flex-1 min-w-0 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && (
                  <p className="text-[10px] font-semibold text-gold mb-0.5 px-1">@{senderName}</p>
                )}
                {msg.gif_url ? (
                  <div className="rounded-xl overflow-hidden max-w-[200px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={msg.gif_url} alt="GIF" className="w-full rounded-xl" />
                    <p className="text-[10px] text-slate-500 mt-0.5 px-1">{timeLabel(msg.created_at)}</p>
                  </div>
                ) : (
                  <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-gold text-[#0a1128] rounded-br-md font-medium'
                      : 'bg-navy-border/70 text-slate-900 rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-0.5 ${isMe ? 'text-[#0a1128]/50 text-right' : 'text-slate-500'}`}>
                      {timeLabel(msg.created_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-navy-border bg-navy-card">
        <div className="flex gap-2 relative">
          {showGif && (
            <GifPicker onSelect={(gif) => { send({ gif_url: gif.url }); setShowGif(false) }} onClose={() => setShowGif(false)} />
          )}
          <button
            onClick={() => setShowGif((v) => !v)}
            className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              showGif ? 'bg-gold text-[#0a1128] border-gold' : 'border-navy-border text-slate-400 hover:text-gold hover:border-gold/40'
            }`}
          >
            GIF
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Say something to the lounge… (Enter)"
            className="input-field flex-1 text-sm"
            disabled={sending}
          />
          <button onClick={() => send()} disabled={sending || !input.trim()} className="btn-gold shrink-0 disabled:opacity-40">
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
