'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface SendResult {
  subscribed?: number
  sent?: number
  failed?: number
  errors?: Array<{ statusCode: number | null; message: string }>
  error?: string
}

interface Props {
  subscribedCount: number
}

export default function PushShooterClient({ subscribedCount }: Props) {
  const router = useRouter()
  const [msg, setMsg] = useState({ title: '', body: '', url: '/' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)

  async function sendPush() {
    if (!msg.title.trim() || !msg.body.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/push-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      })
      const data: SendResult = await res.json()
      setResult(data)
      if (res.ok && (data.sent ?? 0) > 0) {
        setMsg({ title: '', body: '', url: '/' })
      }
      router.refresh()
    } catch (err: any) {
      setResult({ error: err?.message ?? String(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Push Shooter</h1>
        <p className="text-sm text-text-muted mt-1">
          Send a test push to every subscribed user. Free text, no scheduling.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="section-header">Compose message</h2>
        <div className="space-y-4 mt-3">
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              className="input-field"
              placeholder="EFA Announcement"
              value={msg.title}
              maxLength={80}
              onChange={(e) => setMsg({ ...msg, title: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Message</label>
            <textarea
              className="input-field min-h-[96px] resize-none"
              placeholder="Your message here"
              value={msg.body}
              maxLength={300}
              onChange={(e) => setMsg({ ...msg, body: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Tap URL</label>
            <input
              type="text"
              className="input-field"
              placeholder="/"
              value={msg.url}
              onChange={(e) => setMsg({ ...msg, url: e.target.value })}
            />
          </div>
          <Button
            onClick={sendPush}
            isLoading={sending}
            disabled={!msg.title.trim() || !msg.body.trim()}
            variant="primary"
            className="w-full sm:w-auto"
          >
            {sending ? 'Sending...' : `Send to ${subscribedCount} subscribed user${subscribedCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-5">
          <h2 className="section-header">Result</h2>
          {result.error ? (
            <p className="text-sm text-feedback-error mt-2">{result.error}</p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-text-primary">
                Delivered to <span className="font-bold text-accent">{result.sent ?? 0}</span> of {result.subscribed ?? 0} subscriptions.
              </p>
              {(result.failed ?? 0) > 0 && (
                <div className="text-sm text-text-muted">
                  <p>{result.failed} failed:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {(result.errors ?? []).map((e, i) => (
                      <li key={i}>
                        {e.statusCode ? `HTTP ${e.statusCode}: ` : ''}{e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
