'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import GifPicker from './GifPicker'

interface Message {
  id: string
  content: string | null
  gif_url?: string | null
  sender_id: string
  created_at: string
}

interface Props {
  conversationId: string
  currentUserId: string
  initialMessages: Message[]
  otherUsername: string
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

export default function ChatWindow({ conversationId, currentUserId, initialMessages, otherUsername }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Supabase realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          // Avoid duplicates from our own optimistic send
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  const sendMessage = async (opts?: { content?: string; gif_url?: string }) => {
    const content = opts?.content ?? input.trim()
    const gif_url = opts?.gif_url
    if (!content && !gif_url) return
    if (sending) return

    setSending(true)
    if (!gif_url) setInput('')

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, content: content || null, gif_url }),
    })

    if (!res.ok && !gif_url) {
      setInput(content) // restore on failure
    }

    setSending(false)
    inputRef.current?.focus()
  }

  const handleGifSelect = (gif: { url: string }) => {
    sendMessage({ gif_url: gif.url })
    setShowGif(false)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-10">
            No messages yet — say something to @{otherUsername}!
          </p>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] ${msg.gif_url ? '' : `px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-gold text-[#0a1128] rounded-br-md font-medium' : 'bg-navy-border/70 text-slate-900 rounded-bl-md'}`}`}>
                {msg.gif_url ? (
                  /* GIF message */
                  <div className="rounded-xl overflow-hidden max-w-[220px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={msg.gif_url} alt="GIF" className="w-full rounded-xl" />
                    <p className={`text-[10px] mt-0.5 px-1 ${isMe ? 'text-right text-slate-400' : 'text-slate-500'}`}>
                      {timeLabel(msg.created_at)}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-0.5 ${isMe ? 'text-[#0a1128]/50 text-right' : 'text-slate-500'}`}>
                      {timeLabel(msg.created_at)}
                    </p>
                  </>
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
            <GifPicker onSelect={handleGifSelect} onClose={() => setShowGif(false)} />
          )}
          {/* GIF button */}
          <button
            onClick={() => setShowGif((v) => !v)}
            className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              showGif
                ? 'bg-gold text-[#0a1128] border-gold'
                : 'border-navy-border text-slate-400 hover:text-gold hover:border-gold/40'
            }`}
            title="Send a GIF"
          >
            GIF
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Type a message… (Enter to send)"
            className="input-field flex-1 text-sm"
            disabled={sending}
            autoFocus
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            className="btn-gold shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
